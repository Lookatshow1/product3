import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'
import { calculateLosses, DEFAULT_BENCHMARKS } from '@/lib/formulas'

interface ParsedRow {
  dateTime: string
  channel: string
  status: string
  durationSec: number
  result: string
  operatorName: string
  rejectReason: string
  patientId: string
}

function parseCSV(text: string): { rows: ParsedRow[]; errors: Array<{row: number; error: string}> } {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { rows: [], errors: [{ row: 0, error: 'Файл пустой' }] }

  // Detect delimiter
  const header = lines[0]
  const delim = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ','

  const cols = header.split(delim).map(c => c.trim().toLowerCase().replace(/['"]/g, ''))

  const colMap: Record<string, number> = {}
  const mappings: Record<string, string[]> = {
    dateTime: ['date_time', 'datetime', 'дата', 'дата_время', 'дата и время', 'date', 'timestamp'],
    channel: ['channel', 'канал', 'тип', 'type', 'source'],
    status: ['status', 'статус', 'call_status'],
    durationSec: ['duration_sec', 'duration', 'длительность', 'длит', 'dur'],
    result: ['result', 'результат', 'итог', 'outcome'],
    operatorName: ['operator_name', 'operator', 'оператор', 'администратор', 'admin', 'agent'],
    rejectReason: ['reject_reason', 'reason', 'причина', 'причина_отказа'],
    patientId: ['patient_id', 'patient', 'пациент', 'id_пациента', 'phone', 'телефон'],
  }

  for (const [field, aliases] of Object.entries(mappings)) {
    const idx = cols.findIndex(c => aliases.includes(c))
    if (idx !== -1) colMap[field] = idx
  }

  const rows: ParsedRow[] = []
  const errors: Array<{row: number; error: string}> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(delim).map(v => v.trim().replace(/^['"]|['"]$/g, ''))

    try {
      const row: ParsedRow = {
        dateTime: colMap.dateTime !== undefined ? values[colMap.dateTime] : '',
        channel: colMap.channel !== undefined ? values[colMap.channel] : 'phone_in',
        status: colMap.status !== undefined ? values[colMap.status] : 'answered',
        durationSec: colMap.durationSec !== undefined ? parseInt(values[colMap.durationSec]) || 0 : 0,
        result: colMap.result !== undefined ? values[colMap.result] : 'missed',
        operatorName: colMap.operatorName !== undefined ? values[colMap.operatorName] : '',
        rejectReason: colMap.rejectReason !== undefined ? values[colMap.rejectReason] : '',
        patientId: colMap.patientId !== undefined ? values[colMap.patientId] : '',
      }

      if (!row.dateTime) {
        errors.push({ row: i, error: 'Отсутствует дата/время' })
        continue
      }

      rows.push(row)
    } catch {
      errors.push({ row: i, error: 'Ошибка парсинга строки' })
    }
  }

  return { rows, errors }
}

function parseDate(s: string): Date | null {
  // Try various formats
  // DD.MM.YYYY HH:MM
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5])

  // YYYY-MM-DD HH:MM
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])

  // DD/MM/YYYY HH:MM
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5])

  // Fallback
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const statusMap: Record<string, string> = {
  'answered': 'answered', 'принят': 'answered', 'отвечен': 'answered',
  'missed': 'missed', 'пропущен': 'missed', 'неотвечен': 'missed',
  'callback_done': 'callback_done', 'перезвон': 'callback_done',
}

const resultMap: Record<string, string> = {
  'booked': 'booked', 'записан': 'booked', 'запись': 'booked',
  'not_booked': 'not_booked', 'не записан': 'not_booked', 'отказ': 'not_booked',
  'info_only': 'info_only', 'информация': 'info_only', 'консультация': 'info_only',
  'missed': 'missed', 'пропущен': 'missed',
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 })
    }

    const text = await file.text()
    const { rows, errors } = parseCSV(text)

    const imp = await prisma.import.create({
      data: {
        clinicId: clinic.id,
        userId: session.id,
        type: 'journal',
        filename: file.name,
        status: 'processing',
        totalRows: rows.length + errors.length,
        errorRows: errors.length,
        errors: JSON.parse(JSON.stringify(errors)),
      },
    })

    // Create or find operators
    const operatorCache: Record<string, string> = {}
    for (const row of rows) {
      if (row.operatorName && !operatorCache[row.operatorName]) {
        const op = await prisma.operator.upsert({
          where: {
            id: `${clinic.id}-${row.operatorName}`, // This won't work with uuid, use findFirst
          },
          create: { clinicId: clinic.id, name: row.operatorName },
          update: {},
        }).catch(async () => {
          const existing = await prisma.operator.findFirst({
            where: { clinicId: clinic.id, name: row.operatorName },
          })
          if (existing) return existing
          return prisma.operator.create({
            data: { clinicId: clinic.id, name: row.operatorName },
          })
        })
        operatorCache[row.operatorName] = op.id
      }
    }

    // Insert call records
    let validCount = 0
    const dailyAgg: Record<string, { total: number; answered: number; missed: number; booked: number; visited: number; cbDone: number; cbSuccess: number }> = {}

    for (const row of rows) {
      const dt = parseDate(row.dateTime)
      if (!dt) continue

      const dateKey = dt.toISOString().split('T')[0]
      if (!dailyAgg[dateKey]) {
        dailyAgg[dateKey] = { total: 0, answered: 0, missed: 0, booked: 0, visited: 0, cbDone: 0, cbSuccess: 0 }
      }

      const status = statusMap[row.status.toLowerCase()] || row.status || 'answered'
      const result = resultMap[row.result.toLowerCase()] || row.result || 'missed'
      const operatorId = row.operatorName ? operatorCache[row.operatorName] : undefined

      const dateOnly = new Date(dateKey + 'T00:00:00.000Z')

      await prisma.callRecord.create({
        data: {
          clinicId: clinic.id,
          importId: imp.id,
          dateTime: dt,
          date: dateOnly,
          channel: row.channel || 'phone_in',
          status,
          durationSec: row.durationSec || 0,
          result,
          operatorId: operatorId || null,
          rejectReason: row.rejectReason || null,
          patientId: row.patientId || null,
          callbackDone: status === 'callback_done',
          callbackResult: status === 'callback_done' ? result : null,
        },
      })

      dailyAgg[dateKey].total++
      if (status === 'answered' || status === 'callback_done') dailyAgg[dateKey].answered++
      if (status === 'missed') dailyAgg[dateKey].missed++
      if (result === 'booked') dailyAgg[dateKey].booked++
      if (status === 'callback_done') {
        dailyAgg[dateKey].cbDone++
        if (result === 'booked') dailyAgg[dateKey].cbSuccess++
      }
      validCount++
    }

    // Create/update daily funnels and losses
    const bench = await prisma.clinicBenchmark.findUnique({ where: { clinicId: clinic.id } })
    const benchmarks = bench || DEFAULT_BENCHMARKS as typeof bench & typeof DEFAULT_BENCHMARKS

    for (const [dateKey, agg] of Object.entries(dailyAgg)) {
      const dateObj = new Date(dateKey + 'T00:00:00.000Z')

      const funnel = await prisma.dailyFunnel.upsert({
        where: { clinicId_date: { clinicId: clinic.id, date: dateObj } },
        create: {
          clinicId: clinic.id,
          date: dateObj,
          importId: imp.id,
          callsTotal: agg.total,
          callsAnswered: agg.answered,
          callsMissed: agg.missed,
          booked: agg.booked,
          visited: Math.round(agg.booked * 0.8), // estimate if no visit data
          avgCheck: clinic.avgCheck,
          callbacksMade: agg.cbDone,
          callbacksSuccess: agg.cbSuccess,
          source: 'computed',
        },
        update: {
          callsTotal: agg.total,
          callsAnswered: agg.answered,
          callsMissed: agg.missed,
          booked: agg.booked,
          callbacksMade: agg.cbDone,
          callbacksSuccess: agg.cbSuccess,
          source: 'computed',
          importId: imp.id,
        },
      })

      const losses = calculateLosses({
        callsTotal: funnel.callsTotal,
        callsAnswered: funnel.callsAnswered,
        callsMissed: funnel.callsMissed,
        booked: funnel.booked,
        visited: funnel.visited,
        avgCheck: funnel.avgCheck || clinic.avgCheck,
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
      if (agg.missed > 0) {
        const existingTask = await prisma.task.findFirst({
          where: { clinicId: clinic.id, date: dateObj, type: 'callback' },
        })
        if (!existingTask) {
          await prisma.task.create({
            data: {
              clinicId: clinic.id,
              date: dateObj,
              type: 'callback',
              priority: 'high',
              description: `Перезвонить по ${agg.missed} пропущенным`,
            },
          })
        }
      }

      if (agg.booked > 0) {
        const existingTask = await prisma.task.findFirst({
          where: { clinicId: clinic.id, date: dateObj, type: 'confirm_booking' },
        })
        if (!existingTask) {
          await prisma.task.create({
            data: {
              clinicId: clinic.id,
              date: dateObj,
              type: 'confirm_booking',
              priority: 'medium',
              description: `Подтвердить ${agg.booked} записей`,
            },
          })
        }
      }
    }

    await prisma.import.update({
      where: { id: imp.id },
      data: { status: 'completed', validRows: validCount, processedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      importId: imp.id,
      totalRows: rows.length + errors.length,
      validRows: validCount,
      errorRows: errors.length,
      daysProcessed: Object.keys(dailyAgg).length,
    })
  } catch (e: unknown) {
    console.error('Import journal error:', e)
    return NextResponse.json({ error: 'Ошибка импорта' }, { status: 500 })
  }
}
