import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'
import { calculateLosses, DEFAULT_BENCHMARKS, type Benchmarks } from '@/lib/formulas'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const { type, periodStart, periodEnd } = await req.json()

    const start = new Date(periodStart)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(periodEnd)
    end.setUTCHours(23, 59, 59, 999)

    // Get funnel data
    const funnels = await prisma.dailyFunnel.findMany({
      where: { clinicId: clinic.id, date: { gte: start, lte: end } },
    })

    const totals = {
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

    const bench = await prisma.clinicBenchmark.findUnique({ where: { clinicId: clinic.id } })
    const benchmarks: Benchmarks = bench || DEFAULT_BENCHMARKS
    const losses = calculateLosses(totals, benchmarks)

    // Tasks summary
    const tasks = await prisma.task.findMany({
      where: { clinicId: clinic.id, date: { gte: start, lte: end } },
    })
    const tasksDone = tasks.filter(t => t.status === 'done').length

    // Generate HTML report
    const answerRate = totals.callsTotal > 0 ? Math.round(totals.callsAnswered / totals.callsTotal * 100) : 0
    const bookingRate = totals.callsAnswered > 0 ? Math.round(totals.booked / totals.callsAnswered * 100) : 0
    const showRate = totals.booked > 0 ? Math.round(totals.visited / totals.booked * 100) : 0

    const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Отчёт CallFlow OS</title>
<style>
body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#111}
h1{color:#2563eb;font-size:24px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
.card{background:#f9fafb;border-radius:8px;padding:16px;text-align:center;border:1px solid #e5e7eb}
.card .value{font-size:28px;font-weight:700}
.card.loss .value{color:#dc2626}
.card.ok .value{color:#16a34a}
.funnel{background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0}
.bar{height:32px;background:#2563eb;border-radius:4px;margin:4px 0;display:flex;align-items:center;padding:0 12px;color:white;font-weight:600}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb}
th{background:#f9fafb;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px}
</style></head><body>
<h1>CallFlow OS — Отчёт${type === 'owner_summary' ? ' для собственника' : ' детальный'}</h1>
<p><strong>${clinic.name}</strong> | ${start.toLocaleDateString('ru')} — ${end.toLocaleDateString('ru')}</p>
<div class="cards">
  <div class="card loss"><div class="value">${Math.round(losses.lossTotal).toLocaleString('ru')} ₽</div><div>Потери за период</div></div>
  <div class="card"><div class="value">${answerRate}%</div><div>Принятых</div></div>
  <div class="card"><div class="value">${bookingRate}%</div><div>Конверсия</div></div>
  <div class="card"><div class="value">${showRate}%</div><div>Доходимость</div></div>
</div>
<h2>Воронка</h2>
<div class="funnel">
  <div class="bar" style="width:100%">Звонков: ${totals.callsTotal}</div>
  <div class="bar" style="width:${answerRate}%;background:#3b82f6">Принято: ${totals.callsAnswered} (${answerRate}%)</div>
  <div class="bar" style="width:${bookingRate}%;background:#8b5cf6">Записей: ${totals.booked} (${bookingRate}%)</div>
  <div class="bar" style="width:${showRate > 0 ? Math.round(totals.visited/totals.callsTotal*100) : 0}%;background:#16a34a">Визитов: ${totals.visited}</div>
</div>
<h2>Разложение потерь</h2>
<table>
  <tr><th>Тип потерь</th><th>Сумма</th></tr>
  <tr><td>Пропущенные звонки</td><td>${Math.round(losses.lossMissed).toLocaleString('ru')} ₽</td></tr>
  <tr><td>Не перезвонили</td><td>${Math.round(losses.lossNoCallback).toLocaleString('ru')} ₽</td></tr>
  <tr><td>Низкая конверсия</td><td>${Math.round(losses.lossLowConversion).toLocaleString('ru')} ₽</td></tr>
  <tr><td>Неявка</td><td>${Math.round(losses.lossNoShow).toLocaleString('ru')} ₽</td></tr>
  <tr><th>Итого</th><th>${Math.round(losses.lossTotal).toLocaleString('ru')} ₽</th></tr>
</table>
<h2>Задачи</h2>
<p>Выполнено: ${tasksDone} из ${tasks.length} (${tasks.length > 0 ? Math.round(tasksDone/tasks.length*100) : 0}%)</p>
<h2>Прогноз возврата</h2>
<table>
  <tr><td>Минимум (перезвоны)</td><td class="ok">+${Math.round(losses.recoveryMinimum).toLocaleString('ru')} ₽</td></tr>
  <tr><td>Хорошо (+конверсия)</td><td class="ok">+${Math.round(losses.recoveryGood).toLocaleString('ru')} ₽</td></tr>
  <tr><td>Отлично (+доходимость)</td><td class="ok">+${Math.round(losses.recoveryExcellent).toLocaleString('ru')} ₽</td></tr>
</table>
<div class="footer">
  <p>Отчёт сформирован: ${new Date().toLocaleDateString('ru')} | CallFlow OS</p>
  <p>Хотите больше пациентов? Подключите RecPlace для управления репутацией и привлечения.</p>
</div>
</body></html>`

    const report = await prisma.report.create({
      data: {
        clinicId: clinic.id,
        userId: session.id,
        type: type || 'owner_summary',
        format: 'html',
        periodStart: start,
        periodEnd: end,
        status: 'ready',
        fileUrl: null, // HTML stored inline for MVP
      },
    })

    return NextResponse.json({ report, html })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка генерации' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const reports = await prisma.report.findMany({
      where: { clinicId: clinic.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ reports })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
