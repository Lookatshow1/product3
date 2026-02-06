import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    // Run anomaly detection on the fly
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const today = new Date()

    const operators = await prisma.operator.findMany({
      where: { clinicId: clinic.id, isActive: true },
    })

    const anomalies: Array<{
      type: string; severity: string; entityType: string;
      entityName: string; message: string; suggestion: string;
    }> = []

    for (const op of operators) {
      const records = await prisma.callRecord.findMany({
        where: { operatorId: op.id, date: { gte: thirtyDaysAgo } },
      })
      if (records.length < 5) continue

      const answered = records.filter(r => r.status === 'answered')
      const shortCalls = answered.filter(r => r.durationSec > 0 && r.durationSec < 15)

      // Rule 1: Short calls
      if (answered.length > 5 && shortCalls.length / answered.length > 0.3) {
        anomalies.push({
          type: 'short_calls', severity: 'high', entityType: 'operator',
          entityName: op.name,
          message: `${Math.round(shortCalls.length / answered.length * 100)}% звонков <15 сек (норма <10%)`,
          suggestion: 'Проверить: возможен сброс звонков или проблемы с линией',
        })
      }

      // Rule 2: Monotone reject reasons
      const rejected = records.filter(r => r.result === 'not_booked' && r.rejectReason)
      if (rejected.length > 10) {
        const reasons: Record<string, number> = {}
        for (const r of rejected) {
          reasons[r.rejectReason!] = (reasons[r.rejectReason!] || 0) + 1
        }
        const topCount = Math.max(...Object.values(reasons))
        if (topCount / rejected.length > 0.7) {
          const topReason = Object.entries(reasons).find(([, c]) => c === topCount)?.[0]
          anomalies.push({
            type: 'monotone_reasons', severity: 'medium', entityType: 'operator',
            entityName: op.name,
            message: `${Math.round(topCount / rejected.length * 100)}% отказов с причиной "${topReason}"`,
            suggestion: 'Оператор может ставить одну причину не разбираясь',
          })
        }
      }

      // Rule 3: Low booking rate vs clinic average
      const booked = records.filter(r => r.result === 'booked').length
      const bookingRate = answered.length > 0 ? booked / answered.length : 0
      if (bookingRate < 0.35 && answered.length > 10) {
        anomalies.push({
          type: 'low_conversion', severity: 'high', entityType: 'operator',
          entityName: op.name,
          message: `Конверсия ${Math.round(bookingRate * 100)}% (норма >55%)`,
          suggestion: 'Провести разбор звонков и обучение',
        })
      }
    }

    // Rule 5: High missed in prime time (clinic level)
    const allRecords = await prisma.callRecord.findMany({
      where: { clinicId: clinic.id, date: { gte: thirtyDaysAgo } },
    })
    const primeTime = allRecords.filter(r => {
      const h = new Date(r.dateTime).getHours()
      return h >= 9 && h <= 18
    })
    const primeMissed = primeTime.filter(r => r.status === 'missed')
    if (primeTime.length > 20 && primeMissed.length / primeTime.length > 0.2) {
      anomalies.push({
        type: 'missed_prime_time', severity: 'high', entityType: 'clinic',
        entityName: clinic.name,
        message: `${Math.round(primeMissed.length / primeTime.length * 100)}% пропущенных в рабочее время`,
        suggestion: 'Нехватка операторов на линии или технические проблемы',
      })
    }

    // Also return stored anomalies
    const stored = await prisma.anomaly.findMany({
      where: { clinicId: clinic.id },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ anomalies, stored })
  } catch (e: unknown) {
    console.error('Anomalies error:', e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
