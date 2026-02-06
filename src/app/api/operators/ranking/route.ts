import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const operators = await prisma.operator.findMany({
      where: { clinicId: clinic.id, isActive: true },
      orderBy: { name: 'asc' },
    })

    // Calculate KPI for each operator (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const ranking = await Promise.all(operators.map(async (op) => {
      const records = await prisma.callRecord.findMany({
        where: { operatorId: op.id, date: { gte: thirtyDaysAgo } },
      })

      const total = records.length
      const answered = records.filter(r => r.status === 'answered' || r.status === 'callback_done').length
      const missed = records.filter(r => r.status === 'missed').length
      const booked = records.filter(r => r.result === 'booked').length
      const totalDuration = records.reduce((s, r) => s + r.durationSec, 0)
      const avgDuration = answered > 0 ? Math.round(totalDuration / answered) : 0
      const shortCalls = records.filter(r => r.durationSec > 0 && r.durationSec < 15 && r.status === 'answered').length

      const answerRate = total > 0 ? answered / total : 0
      const bookingRate = answered > 0 ? booked / answered : 0

      // Score calculation
      const norm = (v: number, min: number, max: number) => Math.max(0, Math.min(1, (v - min) / (max - min)))
      const durationScore = avgDuration >= 120 && avgDuration <= 240 ? 1 : avgDuration < 60 ? 0.3 : avgDuration > 360 ? 0.5 : 0.7
      const shortCallPenalty = total > 5 && shortCalls / total > 0.3 ? -0.15 : 0

      const score = Math.round((
        0.20 * norm(answerRate, 0.7, 1.0) +
        0.35 * norm(bookingRate, 0.2, 0.8) +
        0.20 * 0.8 + // show rate placeholder
        0.10 * durationScore +
        0.10 * norm(answered > 0 ? 1 : 0, 0, 1) +
        shortCallPenalty
      ) * 100)

      // Unique shifts (days with calls)
      const shifts = new Set(records.map(r => r.date.toISOString().split('T')[0])).size

      return {
        id: op.id,
        name: op.name,
        shifts,
        totalCalls: total,
        answered,
        answerRate: Math.round(answerRate * 100),
        booked,
        bookingRate: Math.round(bookingRate * 100),
        avgDuration,
        shortCalls,
        shortCallPct: total > 0 ? Math.round((shortCalls / total) * 100) : 0,
        score: Math.max(0, Math.min(100, score)),
      }
    }))

    ranking.sort((a, b) => b.score - a.score)

    return NextResponse.json({ operators: ranking })
  } catch (e: unknown) {
    console.error('Operators error:', e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
