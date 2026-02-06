import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'
import { calculateLosses, DEFAULT_BENCHMARKS } from '@/lib/formulas'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const body = await req.json()
    const { date, callsTotal, callsAnswered, callsMissed, booked, visited, avgCheck, callbacksMade, callbacksSuccess } = body

    if (!date || callsTotal === undefined) {
      return NextResponse.json({ error: 'Дата и количество звонков обязательны' }, { status: 400 })
    }

    const dateObj = new Date(date)
    dateObj.setUTCHours(0, 0, 0, 0)

    const imp = await prisma.import.create({
      data: {
        clinicId: clinic.id,
        userId: session.id,
        type: 'funnel',
        status: 'completed',
        totalRows: 1,
        validRows: 1,
        processedAt: new Date(),
      },
    })

    const funnel = await prisma.dailyFunnel.upsert({
      where: { clinicId_date: { clinicId: clinic.id, date: dateObj } },
      create: {
        clinicId: clinic.id,
        date: dateObj,
        importId: imp.id,
        callsTotal: callsTotal || 0,
        callsAnswered: callsAnswered || 0,
        callsMissed: callsMissed || 0,
        booked: booked || 0,
        visited: visited || 0,
        avgCheck: avgCheck || clinic.avgCheck,
        callbacksMade: callbacksMade || 0,
        callbacksSuccess: callbacksSuccess || 0,
        source: 'manual',
      },
      update: {
        callsTotal: callsTotal || 0,
        callsAnswered: callsAnswered || 0,
        callsMissed: callsMissed || 0,
        booked: booked || 0,
        visited: visited || 0,
        avgCheck: avgCheck || clinic.avgCheck,
        callbacksMade: callbacksMade || 0,
        callbacksSuccess: callbacksSuccess || 0,
        importId: imp.id,
        source: 'manual',
      },
    })

    // Calculate losses
    const bench = await prisma.clinicBenchmark.findUnique({ where: { clinicId: clinic.id } })
    const benchmarks = bench || DEFAULT_BENCHMARKS as typeof bench & typeof DEFAULT_BENCHMARKS

    const losses = calculateLosses({
      callsTotal: funnel.callsTotal,
      callsAnswered: funnel.callsAnswered,
      callsMissed: funnel.callsMissed,
      booked: funnel.booked,
      visited: funnel.visited,
      avgCheck: (funnel.avgCheck || clinic.avgCheck),
      callbacksMade: funnel.callbacksMade,
      callbacksSuccess: funnel.callbacksSuccess,
    }, {
      answerRateTarget: benchmarks.answerRateTarget,
      bookingRateTarget: benchmarks.bookingRateTarget,
      showRateTarget: benchmarks.showRateTarget,
      callbackSuccessRate: benchmarks.callbackSuccessRate,
      bookingRateCallback: benchmarks.bookingRateCallback,
      avgMargin: benchmarks.avgMargin,
    })

    await prisma.dailyLoss.upsert({
      where: { clinicId_date: { clinicId: clinic.id, date: dateObj } },
      create: {
        clinicId: clinic.id,
        date: dateObj,
        ...losses,
        funnelData: JSON.parse(JSON.stringify(funnel)),
        coefficients: JSON.parse(JSON.stringify(benchmarks)),
      },
      update: {
        ...losses,
        funnelData: JSON.parse(JSON.stringify(funnel)),
        coefficients: JSON.parse(JSON.stringify(benchmarks)),
        calculatedAt: new Date(),
      },
    })

    // Generate tasks
    const taskDate = new Date(dateObj)
    const missed = funnel.callsMissed || 0
    const cbMade = funnel.callbacksMade || 0
    const needCallbacks = Math.max(0, missed - cbMade)
    const needConfirm = funnel.booked || 0

    if (needCallbacks > 0) {
      await prisma.task.create({
        data: {
          clinicId: clinic.id,
          date: dateObj,
          type: 'callback',
          priority: 'high',
          description: `Перезвонить по ${needCallbacks} пропущенным звонкам`,
          deadline: new Date(taskDate.getTime() + 4 * 60 * 60 * 1000),
        },
      })
    }

    if (needConfirm > 0) {
      await prisma.task.create({
        data: {
          clinicId: clinic.id,
          date: dateObj,
          type: 'confirm_booking',
          priority: 'medium',
          description: `Подтвердить ${needConfirm} записей на приём`,
          deadline: new Date(taskDate.getTime() + 9 * 60 * 60 * 1000),
        },
      })
    }

    const notBooked = Math.max(0, (funnel.callsAnswered || 0) - (funnel.booked || 0))
    if (notBooked > 3) {
      await prisma.task.create({
        data: {
          clinicId: clinic.id,
          date: dateObj,
          type: 'follow_up',
          priority: 'low',
          description: `Дожим: ${notBooked} обращений без записи`,
          deadline: new Date(taskDate.getTime() + 10 * 60 * 60 * 1000),
        },
      })
    }

    return NextResponse.json({ success: true, losses, funnel: { id: funnel.id } })
  } catch (e: unknown) {
    console.error('Import funnel error:', e)
    return NextResponse.json({ error: 'Ошибка импорта' }, { status: 500 })
  }
}
