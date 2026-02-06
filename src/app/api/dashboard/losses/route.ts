import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'
import { calculateLosses, generateTopLeaks, DEFAULT_BENCHMARKS, type FunnelData, type Benchmarks } from '@/lib/formulas'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '7d'

    const now = new Date()
    let startDate: Date
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999)

    switch (period) {
      case 'today':
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'yesterday':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 1)
        startDate.setHours(0, 0, 0, 0)
        endDate.setDate(endDate.getDate() - 1)
        break
      case '30d':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 30)
        startDate.setHours(0, 0, 0, 0)
        break
      default: // 7d
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
    }

    // Get funnels for period
    const funnels = await prisma.dailyFunnel.findMany({
      where: {
        clinicId: clinic.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    })

    // Get pre-calculated losses
    const losses = await prisma.dailyLoss.findMany({
      where: {
        clinicId: clinic.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    })

    // Aggregate
    const totals: FunnelData = {
      callsTotal: 0, callsAnswered: 0, callsMissed: 0,
      booked: 0, visited: 0, avgCheck: clinic.avgCheck,
      callbacksMade: 0, callbacksSuccess: 0,
    }

    for (const f of funnels) {
      totals.callsTotal += f.callsTotal
      totals.callsAnswered += f.callsAnswered
      totals.callsMissed += f.callsMissed
      totals.booked += f.booked
      totals.visited += f.visited
      totals.callbacksMade += f.callbacksMade
      totals.callbacksSuccess += f.callbacksSuccess
    }

    const totalLosses = {
      lossMissed: losses.reduce((s, l) => s + l.lossMissed, 0),
      lossNoCallback: losses.reduce((s, l) => s + l.lossNoCallback, 0),
      lossLowConversion: losses.reduce((s, l) => s + l.lossLowConversion, 0),
      lossNoShow: losses.reduce((s, l) => s + l.lossNoShow, 0),
      lossTotal: losses.reduce((s, l) => s + l.lossTotal, 0),
      recoveryMinimum: losses.reduce((s, l) => s + l.recoveryMinimum, 0),
      recoveryGood: losses.reduce((s, l) => s + l.recoveryGood, 0),
      recoveryExcellent: losses.reduce((s, l) => s + l.recoveryExcellent, 0),
    }

    // Get benchmarks
    const bench = await prisma.clinicBenchmark.findUnique({ where: { clinicId: clinic.id } })
    const benchmarks: Benchmarks = bench || DEFAULT_BENCHMARKS

    // Calculate current metrics
    const currentLosses = calculateLosses(totals, benchmarks)

    // Top leaks
    const topLeaks = generateTopLeaks(totals, benchmarks, currentLosses)

    // Previous period for comparison
    const prevStart = new Date(startDate)
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    prevStart.setDate(prevStart.getDate() - periodDays)

    const prevLosses = await prisma.dailyLoss.findMany({
      where: {
        clinicId: clinic.id,
        date: { gte: prevStart, lt: startDate },
      },
    })
    const prevTotal = prevLosses.reduce((s, l) => s + l.lossTotal, 0)
    const changeVsPrev = prevTotal > 0 ? ((totalLosses.lossTotal - prevTotal) / prevTotal) : 0

    // Daily trend
    const trend = losses.map(l => ({
      date: l.date,
      lossTotal: Math.round(l.lossTotal),
      lossMissed: Math.round(l.lossMissed),
      lossNoCallback: Math.round(l.lossNoCallback),
      lossLowConversion: Math.round(l.lossLowConversion),
      lossNoShow: Math.round(l.lossNoShow),
    }))

    return NextResponse.json({
      period,
      periodDays,
      funnel: totals,
      losses: {
        ...totalLosses,
        lossMissed: Math.round(totalLosses.lossMissed),
        lossNoCallback: Math.round(totalLosses.lossNoCallback),
        lossLowConversion: Math.round(totalLosses.lossLowConversion),
        lossNoShow: Math.round(totalLosses.lossNoShow),
        lossTotal: Math.round(totalLosses.lossTotal),
        recoveryMinimum: Math.round(totalLosses.recoveryMinimum),
        recoveryGood: Math.round(totalLosses.recoveryGood),
        recoveryExcellent: Math.round(totalLosses.recoveryExcellent),
      },
      metrics: currentLosses.metrics,
      topLeaks,
      changeVsPrev: Math.round(changeVsPrev * 100),
      trend,
      benchmarks,
      hasFunnelData: funnels.length > 0,
    })
  } catch (e: unknown) {
    console.error('Dashboard losses error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки данных' }, { status: 500 })
  }
}
