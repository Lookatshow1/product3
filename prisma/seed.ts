import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic-ish seeded random so every run yields the same shape of data */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = seededRandom(42)

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randFloat(min: number, max: number): number {
  return rand() * (max - min) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/** Midnight UTC date for a given offset from today */
function dateOffset(daysBack: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d
}

/** Same date, but with a specific hour:minute for call records */
function dateTimeAt(base: Date, hour: number, minute: number): Date {
  const d = new Date(base)
  d.setUTCHours(hour, minute, randInt(0, 59), 0)
  return d
}

// ---------------------------------------------------------------------------
// Loss calculation (mirrors src/lib/formulas.ts)
// ---------------------------------------------------------------------------

interface Benchmarks {
  answerRateTarget: number
  bookingRateTarget: number
  showRateTarget: number
  callbackSuccessRate: number
  bookingRateCallback: number
  avgMargin: number
}

interface FunnelRow {
  callsTotal: number
  callsAnswered: number
  callsMissed: number
  booked: number
  visited: number
  avgCheck: number
  callbacksMade: number
  callbacksSuccess: number
}

function calculateLosses(f: FunnelRow, b: Benchmarks) {
  const avgCheck = f.avgCheck || 5000
  const answered = f.callsAnswered || 0
  const missed = f.callsMissed || 0
  const booked = f.booked || 0
  const visited = f.visited || 0
  const cbMade = f.callbacksMade || 0
  const cbSuccess = f.callbacksSuccess || 0

  const actualBookingRate = answered > 0 ? booked / answered : 0
  const actualShowRate = booked > 0 ? visited / booked : 0
  const actualAnswerRate = f.callsTotal > 0 ? answered / f.callsTotal : 0
  const actualCallbackRate = missed > 0 ? cbMade / missed : 0

  const lossMissed = missed * b.bookingRateTarget * b.showRateTarget * avgCheck
  const notCalledBack = Math.max(0, missed - cbSuccess)
  const lossNoCallback = notCalledBack * b.bookingRateCallback * b.showRateTarget * avgCheck
  const conversionGap = Math.max(0, b.bookingRateTarget - actualBookingRate)
  const lossLowConversion = answered * conversionGap * b.showRateTarget * avgCheck
  const lossNoShow = Math.max(0, booked - visited) * avgCheck
  const lossTotal = lossMissed + lossNoCallback + lossLowConversion + lossNoShow

  const actionableCallbacks = Math.max(0, missed - cbMade)
  const recoveryMinimum =
    actionableCallbacks * b.callbackSuccessRate * b.bookingRateCallback * b.showRateTarget * avgCheck
  const recoveryGood = recoveryMinimum + answered * 0.1 * b.showRateTarget * avgCheck
  const recoveryExcellent = recoveryGood + booked * 0.1 * avgCheck

  return {
    lossMissed: Math.round(lossMissed),
    lossNoCallback: Math.round(lossNoCallback),
    lossLowConversion: Math.round(lossLowConversion),
    lossNoShow: Math.round(lossNoShow),
    lossTotal: Math.round(lossTotal),
    recoveryMinimum: Math.round(recoveryMinimum),
    recoveryGood: Math.round(recoveryGood),
    recoveryExcellent: Math.round(recoveryExcellent),
    metrics: {
      answerRate: actualAnswerRate,
      bookingRate: actualBookingRate,
      showRate: actualShowRate,
      callbackRate: actualCallbackRate,
    },
  }
}

// ---------------------------------------------------------------------------
// IDs (fixed UUIDs so the script is idempotent / reproducible)
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-4000-a000-000000000001'
const CLINIC_ID = '00000000-0000-4000-a000-000000000002'
const USER_ID = '00000000-0000-4000-a000-000000000003'
const OP_PETROVA_ID = '00000000-0000-4000-a000-000000000010'
const OP_SIDOROVA_ID = '00000000-0000-4000-a000-000000000011'
const OP_IVANOVA_ID = '00000000-0000-4000-a000-000000000012'

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding CallFlow OS demo data ...')

  // ------ Cleanup (idempotent) ------
  // Delete in correct order to respect FK constraints.
  // We scope deletion to the known demo org / clinic to avoid nuking real data.
  console.log('  Cleaning previous demo data ...')

  await prisma.notification.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.notificationSetting.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.report.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.anomaly.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.task.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.dailyLoss.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.dailyFunnel.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.callRecord.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.import.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.script.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.lessonProgress.deleteMany({ where: { userId: USER_ID } })
  await prisma.lesson.deleteMany({})
  await prisma.lessonCategory.deleteMany({})
  await prisma.scriptCategory.deleteMany({})
  await prisma.clinicBenchmark.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.operator.deleteMany({ where: { clinicId: CLINIC_ID } })
  await prisma.user.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.clinic.deleteMany({ where: { organizationId: ORG_ID } })
  await prisma.organization.deleteMany({ where: { id: ORG_ID } })

  // ------ 1. Organization ------
  console.log('  Creating organization ...')
  const org = await prisma.organization.create({
    data: {
      id: ORG_ID,
      name: 'Демо-клиника',
      billingPlan: 'pro',
      billingStatus: 'active',
    },
  })

  // ------ 2. Clinic ------
  console.log('  Creating clinic ...')
  const clinic = await prisma.clinic.create({
    data: {
      id: CLINIC_ID,
      organizationId: org.id,
      name: 'Стоматология «Демо»',
      type: 'dental',
      timezone: 'Europe/Moscow',
      chairsCount: 5,
      avgCheck: 8500,
      workStart: '09:00',
      workEnd: '21:00',
      privacyMode: 'anonymous',
      consentOk: true,
    },
  })

  // ------ 3. User ------
  console.log('  Creating demo user ...')
  const passwordHash = await hash('demo123456', 10)
  const user = await prisma.user.create({
    data: {
      id: USER_ID,
      organizationId: org.id,
      clinicId: clinic.id,
      email: 'demo@callflow.ru',
      passwordHash,
      name: 'Демо Пользователь',
      role: 'owner',
      isActive: true,
    },
  })

  // ------ 4. Benchmarks ------
  console.log('  Creating benchmarks ...')
  const benchmarks: Benchmarks = {
    answerRateTarget: 0.9,
    bookingRateTarget: 0.55,
    showRateTarget: 0.85,
    callbackSuccessRate: 0.6,
    bookingRateCallback: 0.35,
    avgMargin: 0.6,
  }
  await prisma.clinicBenchmark.create({
    data: {
      clinicId: clinic.id,
      ...benchmarks,
    },
  })

  // ------ 5. Operators ------
  console.log('  Creating operators ...')
  const opPetrova = await prisma.operator.create({
    data: { id: OP_PETROVA_ID, clinicId: clinic.id, name: 'Петрова М.В.', externalId: 'ext-101' },
  })
  const opSidorova = await prisma.operator.create({
    data: { id: OP_SIDOROVA_ID, clinicId: clinic.id, name: 'Сидорова К.А.', externalId: 'ext-102' },
  })
  const opIvanova = await prisma.operator.create({
    data: { id: OP_IVANOVA_ID, clinicId: clinic.id, name: 'Иванова А.С.', externalId: 'ext-103' },
  })

  // Operator profiles for call generation
  const operatorProfiles = [
    { op: opPetrova, bookingRate: 0.52, avgDuration: 180, shortCallChance: 0.05, weight: 0.40 },
    { op: opSidorova, bookingRate: 0.40, avgDuration: 150, shortCallChance: 0.10, weight: 0.35 },
    { op: opIvanova, bookingRate: 0.28, avgDuration: 110, shortCallChance: 0.25, weight: 0.25 },
  ]

  // ------ 6. Daily Funnels (30 days) ------
  console.log('  Creating daily funnels (30 days) ...')
  const funnelRows: Array<FunnelRow & { date: Date }> = []

  for (let daysBack = 29; daysBack >= 0; daysBack--) {
    const date = dateOffset(daysBack)
    const weekend = isWeekend(date)

    const callsTotal = weekend ? randInt(25, 40) : randInt(70, 100)
    const answerPct = randFloat(0.74, 0.82)
    const callsAnswered = Math.round(callsTotal * answerPct)
    const callsMissed = callsTotal - callsAnswered

    const bookingPct = randFloat(0.38, 0.48)
    const booked = Math.round(callsAnswered * bookingPct)

    const showPct = randFloat(0.72, 0.82)
    const visited = Math.round(booked * showPct)

    const callbacksMade = Math.round(callsMissed * randFloat(0.45, 0.70))
    const callbacksSuccess = Math.round(callbacksMade * randFloat(0.40, 0.65))

    const avgCheckDay = randInt(7500, 9500)

    const row: FunnelRow & { date: Date } = {
      date,
      callsTotal,
      callsAnswered,
      callsMissed,
      booked,
      visited,
      avgCheck: avgCheckDay,
      callbacksMade,
      callbacksSuccess,
    }
    funnelRows.push(row)

    await prisma.dailyFunnel.create({
      data: {
        clinicId: clinic.id,
        date,
        callsTotal,
        callsAnswered,
        callsMissed,
        booked,
        visited,
        avgCheck: avgCheckDay,
        callbacksMade,
        callbacksSuccess,
        source: 'seed',
      },
    })
  }

  // ------ 7. Daily Losses ------
  console.log('  Calculating and storing daily losses ...')
  for (const row of funnelRows) {
    const losses = calculateLosses(row, benchmarks)

    await prisma.dailyLoss.create({
      data: {
        clinicId: clinic.id,
        date: row.date,
        lossMissed: losses.lossMissed,
        lossNoCallback: losses.lossNoCallback,
        lossLowConversion: losses.lossLowConversion,
        lossNoShow: losses.lossNoShow,
        lossTotal: losses.lossTotal,
        recoveryMinimum: losses.recoveryMinimum,
        recoveryGood: losses.recoveryGood,
        recoveryExcellent: losses.recoveryExcellent,
        funnelData: {
          callsTotal: row.callsTotal,
          callsAnswered: row.callsAnswered,
          callsMissed: row.callsMissed,
          booked: row.booked,
          visited: row.visited,
          avgCheck: row.avgCheck,
          callbacksMade: row.callbacksMade,
          callbacksSuccess: row.callbacksSuccess,
        },
        coefficients: { ...benchmarks },
      },
    })
  }

  // ------ 8. Call Records (last 3 days) ------
  console.log('  Creating call records (last 3 days) ...')

  const channels: Array<{ value: string; weight: number }> = [
    { value: 'phone_in', weight: 0.80 },
    { value: 'web_form', weight: 0.10 },
    { value: 'whatsapp', weight: 0.05 },
    { value: 'callback', weight: 0.05 },
  ]

  function pickChannel(): string {
    const r = rand()
    let cum = 0
    for (const ch of channels) {
      cum += ch.weight
      if (r <= cum) return ch.value
    }
    return 'phone_in'
  }

  function pickOperatorProfile() {
    const r = rand()
    let cum = 0
    for (const p of operatorProfiles) {
      cum += p.weight
      if (r <= cum) return p
    }
    return operatorProfiles[0]
  }

  const rejectReasons = [
    'Дорого',
    'Подумаю',
    'Не тот профиль',
    'Нет нужного времени',
    'Спросил только цену',
    'Записался в другую клинику',
  ]

  const callRecordIds: string[] = []

  for (let daysBack = 2; daysBack >= 0; daysBack--) {
    const date = dateOffset(daysBack)
    const weekend = isWeekend(date)
    const numCalls = weekend ? randInt(20, 30) : randInt(25, 35)

    // Distribute calls across working hours 09:00-21:00 with peak 10-13 and 17-19
    const peakHours = [10, 11, 12, 13, 17, 18]
    const normalHours = [9, 14, 15, 16, 19, 20]

    for (let c = 0; c < numCalls; c++) {
      const isPeak = rand() < 0.55
      const hour = isPeak ? pick(peakHours) : pick(normalHours)
      const minute = randInt(0, 59)
      const dateTime = dateTimeAt(date, hour, minute)
      const channel = pickChannel()

      // ~22% of calls are missed
      const isMissed = rand() < 0.22

      if (isMissed) {
        const rec = await prisma.callRecord.create({
          data: {
            clinicId: clinic.id,
            dateTime,
            date,
            channel,
            status: 'missed',
            durationSec: 0,
            result: 'missed',
            callbackDone: rand() < 0.55,
            callbackAt: rand() < 0.55 ? dateTimeAt(date, Math.min(hour + 1, 20), randInt(0, 59)) : null,
            callbackResult: rand() < 0.4 ? 'booked' : rand() < 0.5 ? 'no_answer' : 'refused',
          },
        })
        callRecordIds.push(rec.id)
        continue
      }

      // Answered call - pick operator
      const profile = pickOperatorProfile()
      const isShortCall = rand() < profile.shortCallChance
      const durationSec = isShortCall
        ? randInt(8, 35)
        : Math.round(profile.avgDuration + randInt(-60, 80))

      // Determine result based on operator skill
      let result: string
      if (isShortCall) {
        result = 'no_result'
      } else if (rand() < profile.bookingRate) {
        result = 'booked'
      } else {
        result = rand() < 0.3 ? 'info_only' : 'refused'
      }

      const rejectReason = result === 'refused' ? pick(rejectReasons) : null

      const rec = await prisma.callRecord.create({
        data: {
          clinicId: clinic.id,
          dateTime,
          date,
          channel,
          status: 'answered',
          durationSec: Math.max(durationSec, 5),
          result,
          operatorId: profile.op.id,
          rejectReason: rejectReason,
          callbackDone: false,
        },
      })
      callRecordIds.push(rec.id)
    }
  }

  // ------ 9. Tasks for today ------
  console.log('  Creating tasks for today ...')
  const today = dateOffset(0)

  // Get some missed call IDs from today for task references
  const todayRecords = await prisma.callRecord.findMany({
    where: { clinicId: clinic.id, date: today },
    orderBy: { dateTime: 'asc' },
  })

  const missedToday = todayRecords.filter((r) => r.status === 'missed')
  const answeredBooked = todayRecords.filter((r) => r.result === 'booked')
  const answeredRefused = todayRecords.filter((r) => r.result === 'refused')

  // Callback tasks for missed calls
  for (let i = 0; i < Math.min(missedToday.length, 5); i++) {
    const call = missedToday[i]
    await prisma.task.create({
      data: {
        clinicId: clinic.id,
        date: today,
        type: 'callback',
        priority: 'high',
        status: i < 2 ? 'completed' : 'open',
        deadline: dateTimeAt(today, 12, 0),
        description: `Перезвонить по пропущенному звонку (${call.channel}, ${call.dateTime.toISOString().slice(11, 16)})`,
        sourceCallId: call.id,
        assignedOperatorId: pick([opPetrova.id, opSidorova.id, opIvanova.id]),
        completedById: i < 2 ? user.id : null,
        completedAt: i < 2 ? dateTimeAt(today, 10 + i, randInt(10, 50)) : null,
        result: i < 2 ? (i === 0 ? 'booked' : 'no_answer') : null,
      },
    })
  }

  // Confirmation tasks for booked patients
  for (let i = 0; i < Math.min(answeredBooked.length, 4); i++) {
    const call = answeredBooked[i]
    await prisma.task.create({
      data: {
        clinicId: clinic.id,
        date: today,
        type: 'confirmation',
        priority: 'medium',
        status: i < 1 ? 'completed' : 'open',
        deadline: dateTimeAt(today, 18, 0),
        description: `Подтвердить запись пациента (звонок ${call.dateTime.toISOString().slice(11, 16)})`,
        sourceCallId: call.id,
        assignedOperatorId: call.operatorId,
        completedById: i < 1 ? user.id : null,
        completedAt: i < 1 ? dateTimeAt(today, 11, randInt(0, 30)) : null,
        result: i < 1 ? 'confirmed' : null,
      },
    })
  }

  // Re-engagement tasks for refused calls
  for (let i = 0; i < Math.min(answeredRefused.length, 3); i++) {
    const call = answeredRefused[i]
    await prisma.task.create({
      data: {
        clinicId: clinic.id,
        date: today,
        type: 'reengagement',
        priority: 'low',
        status: 'open',
        deadline: dateTimeAt(today, 20, 0),
        description: `Повторный контакт: отказ «${call.rejectReason || 'Не указана причина'}» (${call.dateTime.toISOString().slice(11, 16)})`,
        sourceCallId: call.id,
        assignedOperatorId: call.operatorId,
      },
    })
  }

  // Generic daily tasks
  await prisma.task.create({
    data: {
      clinicId: clinic.id,
      date: today,
      type: 'review',
      priority: 'medium',
      status: 'open',
      deadline: dateTimeAt(today, 14, 0),
      description: 'Разобрать звонки с низкой конверсией за вчера',
      assignedOperatorId: opIvanova.id,
    },
  })

  await prisma.task.create({
    data: {
      clinicId: clinic.id,
      date: today,
      type: 'report',
      priority: 'low',
      status: 'open',
      deadline: dateTimeAt(today, 20, 0),
      description: 'Проверить воронку за неделю и обновить бенчмарки при необходимости',
    },
  })

  // ------ 10. Lesson categories & lessons ------
  console.log('  Creating lesson categories and lessons ...')

  const lessonCat1 = await prisma.lessonCategory.create({
    data: { name: 'Приём входящего звонка', sortOrder: 1 },
  })
  const lessonCat2 = await prisma.lessonCategory.create({
    data: { name: 'Работа с возражениями', sortOrder: 2 },
  })
  const lessonCat3 = await prisma.lessonCategory.create({
    data: { name: 'Запись и подтверждение', sortOrder: 3 },
  })
  const lessonCat4 = await prisma.lessonCategory.create({
    data: { name: 'Перезвон по пропущенным', sortOrder: 4 },
  })

  await prisma.lesson.create({
    data: {
      categoryId: lessonCat1.id,
      title: 'Приветствие и выявление потребности',
      situation:
        'Пациент звонит впервые, говорит: «Здравствуйте, я хотел бы узнать стоимость лечения зуба». Оператор должен установить контакт и выяснить ситуацию.',
      correctScript:
        '«Здравствуйте! Стоматология "Демо", меня зовут [Имя]. Подскажите, пожалуйста, вас беспокоит что-то конкретное — боль, дискомфорт? Чтобы я могла точнее сориентировать по стоимости, расскажите немного подробнее.»',
      incorrectScript:
        '«Здравствуйте. Лечение зуба — от 5000 рублей. Записать вас?»',
      incorrectExplanation:
        'Оператор сразу назвал цену, не установил контакт, не выявил потребность. Пациент не чувствует заботу и с высокой вероятностью продолжит обзвон других клиник.',
      quizQuestion: 'Что нужно сделать в первую очередь при входящем звонке нового пациента?',
      quizOptions: [
        'Назвать цену услуги',
        'Представиться и выявить потребность',
        'Предложить акцию',
        'Спросить откуда узнали о клинике',
      ],
      quizCorrectIndex: 1,
      sortOrder: 1,
    },
  })

  await prisma.lesson.create({
    data: {
      categoryId: lessonCat2.id,
      title: 'Возражение «Дорого»',
      situation:
        'Пациент говорит: «У вас дорого, в клинике через дорогу дешевле». Нужно обработать возражение и сохранить запись.',
      correctScript:
        '«Понимаю, цена — важный фактор. Давайте я расскажу, что входит в стоимость: мы используем [материал/метод], включена гарантия [срок]. Многие пациенты сравнивают и возвращаются к нам, потому что итоговая стоимость лечения оказывается ниже. Могу записать вас на бесплатную консультацию — доктор составит план и точную смету.»',
      incorrectScript:
        '«Ну, у нас такие цены. Если не устраивает — попробуйте в другом месте.»',
      incorrectExplanation:
        'Оператор не попытался объяснить ценность, отпустил пациента. Потерян потенциальный доход и возможность записи.',
      quizQuestion: 'Как правильно реагировать на возражение «Дорого»?',
      quizOptions: [
        'Предложить скидку',
        'Объяснить ценность и предложить консультацию',
        'Согласиться и попрощаться',
        'Сказать что у конкурентов хуже качество',
      ],
      quizCorrectIndex: 1,
      sortOrder: 1,
    },
  })

  await prisma.lesson.create({
    data: {
      categoryId: lessonCat4.id,
      title: 'Перезвон в течение 30 минут',
      situation:
        'Пропущенный звонок зафиксирован 15 минут назад. Оператор перезванивает пациенту.',
      correctScript:
        '«Здравствуйте! Это стоматология "Демо". Вы нам звонили — к сожалению, не успели ответить. Подскажите, чем могу помочь? Если вы хотели записаться — у нас есть удобное время на этой неделе.»',
      incorrectScript:
        '«Алло, вы звонили?»',
      incorrectExplanation:
        'Оператор не представился, не назвал клинику, не выразил сожаление о пропущенном звонке. Пациент может не вспомнить, куда звонил, и потерять доверие.',
      quizQuestion: 'Какой максимальный рекомендуемый интервал для перезвона по пропущенному?',
      quizOptions: ['5 минут', '30 минут', '2 часа', 'До конца рабочего дня'],
      quizCorrectIndex: 1,
      sortOrder: 1,
    },
  })

  // ------ 11. Script categories & scripts ------
  console.log('  Creating script categories and scripts ...')

  const scriptCat1 = await prisma.scriptCategory.create({
    data: { name: 'Приветствие', sortOrder: 1 },
  })
  const scriptCat2 = await prisma.scriptCategory.create({
    data: { name: 'Выявление потребности', sortOrder: 2 },
  })
  const scriptCat3 = await prisma.scriptCategory.create({
    data: { name: 'Работа с возражениями', sortOrder: 3 },
  })
  const scriptCat4 = await prisma.scriptCategory.create({
    data: { name: 'Запись на приём', sortOrder: 4 },
  })
  const scriptCat5 = await prisma.scriptCategory.create({
    data: { name: 'Перезвон по пропущенным', sortOrder: 5 },
  })
  const scriptCat6 = await prisma.scriptCategory.create({
    data: { name: 'Подтверждение записи', sortOrder: 6 },
  })

  const scriptTexts: Array<{
    categoryId: string
    type: string
    text: string
    complianceNote: string | null
  }> = [
    {
      categoryId: scriptCat1.id,
      type: 'greeting',
      text: '«Здравствуйте! Стоматология "Демо", меня зовут [Имя]. Чем могу вам помочь?»',
      complianceNote: 'Обязательно назвать название клиники и своё имя.',
    },
    {
      categoryId: scriptCat2.id,
      type: 'discovery',
      text: '«Подскажите, пожалуйста, что вас беспокоит? Есть ли болевые ощущения? Вы уже были на консультации у стоматолога ранее?»',
      complianceNote: 'Задать минимум 2 уточняющих вопроса перед называнием цены.',
    },
    {
      categoryId: scriptCat3.id,
      type: 'objection_price',
      text: '«Понимаю, что стоимость важна. В нашу цену входит: [перечислить]. Также у нас есть рассрочка без переплат. Давайте запишу вас на бесплатную консультацию — доктор составит точный план лечения.»',
      complianceNote: 'Никогда не критиковать конкурентов напрямую.',
    },
    {
      categoryId: scriptCat4.id,
      type: 'booking',
      text: '«Отлично! Давайте подберём удобное время. У нас есть окна: [перечислить 2-3 варианта]. Какое вам подходит? Записываю вас на [дата, время] к доктору [Имя]. За день до приёма мы вам позвоним для подтверждения.»',
      complianceNote: 'Всегда предлагать 2-3 варианта времени, не спрашивать «когда вам удобно» открытым вопросом.',
    },
    {
      categoryId: scriptCat5.id,
      type: 'callback_missed',
      text: '«Здравствуйте! Это стоматология "Демо". Вы нам звонили, к сожалению мы не успели ответить. Подскажите, чем могу помочь? У нас есть удобные окна для записи на этой неделе.»',
      complianceNote: 'Перезвон должен состояться в течение 30 минут. Обязательно извиниться за пропущенный звонок.',
    },
    {
      categoryId: scriptCat6.id,
      type: 'confirmation',
      text: '«Здравствуйте, [Имя пациента]! Это стоматология "Демо". Напоминаем, что завтра в [время] у вас приём у доктора [Имя]. Всё в силе? Если нужно перенести — подберём другое время.»',
      complianceNote: 'Подтверждение за 24 часа до приёма. Если пациент хочет перенести — предложить ближайшие даты, не отменять.',
    },
  ]

  for (const s of scriptTexts) {
    await prisma.script.create({
      data: {
        categoryId: s.categoryId,
        clinicId: clinic.id,
        type: s.type,
        text: s.text,
        complianceNote: s.complianceNote,
      },
    })
  }

  // ------ 12. Notification settings ------
  console.log('  Creating notification settings ...')
  await prisma.notificationSetting.create({
    data: {
      clinicId: clinic.id,
      emailMorning: true,
      emailMorningTime: '08:30',
      emailMidday: true,
      emailMiddayTime: '12:30',
      emailEvening: true,
      emailEveningTime: '20:30',
      emailRecipients: ['demo@callflow.ru'],
      webPushEnabled: true,
    },
  })

  // ------ Summary ------
  const totalFunnels = await prisma.dailyFunnel.count({ where: { clinicId: clinic.id } })
  const totalLosses = await prisma.dailyLoss.count({ where: { clinicId: clinic.id } })
  const totalCalls = await prisma.callRecord.count({ where: { clinicId: clinic.id } })
  const totalTasks = await prisma.task.count({ where: { clinicId: clinic.id } })
  const totalLessons = await prisma.lesson.count()
  const totalScripts = await prisma.script.count({ where: { clinicId: clinic.id } })

  console.log('')
  console.log('  Seed complete!')
  console.log(`    Organization : ${org.name}`)
  console.log(`    Clinic       : ${clinic.name}`)
  console.log(`    User         : ${user.email} (password: demo123456)`)
  console.log(`    Operators    : Петрова М.В., Сидорова К.А., Иванова А.С.`)
  console.log(`    Funnels      : ${totalFunnels} days`)
  console.log(`    Losses       : ${totalLosses} days`)
  console.log(`    Call records : ${totalCalls}`)
  console.log(`    Tasks        : ${totalTasks}`)
  console.log(`    Lessons      : ${totalLessons}`)
  console.log(`    Scripts      : ${totalScripts}`)
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
