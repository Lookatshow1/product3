export interface FunnelData {
  callsTotal: number
  callsAnswered: number
  callsMissed: number
  booked: number
  visited: number
  avgCheck: number
  callbacksMade: number
  callbacksSuccess: number
}

export interface Benchmarks {
  answerRateTarget: number
  bookingRateTarget: number
  showRateTarget: number
  callbackSuccessRate: number
  bookingRateCallback: number
  avgMargin: number
}

export interface LossResult {
  lossMissed: number
  lossNoCallback: number
  lossLowConversion: number
  lossNoShow: number
  lossTotal: number
  recoveryMinimum: number
  recoveryGood: number
  recoveryExcellent: number
  metrics: {
    answerRate: number
    bookingRate: number
    showRate: number
    callbackRate: number
  }
}

export const DEFAULT_BENCHMARKS: Benchmarks = {
  answerRateTarget: 0.9,
  bookingRateTarget: 0.55,
  showRateTarget: 0.85,
  callbackSuccessRate: 0.6,
  bookingRateCallback: 0.35,
  avgMargin: 0.6,
}

export function calculateLosses(funnel: FunnelData, bench: Benchmarks): LossResult {
  const avgCheck = funnel.avgCheck || 5000
  const answered = funnel.callsAnswered || 0
  const missed = funnel.callsMissed || 0
  const booked = funnel.booked || 0
  const visited = funnel.visited || 0
  const cbMade = funnel.callbacksMade || 0
  const cbSuccess = funnel.callbacksSuccess || 0

  const actualBookingRate = answered > 0 ? booked / answered : 0
  const actualShowRate = booked > 0 ? visited / booked : 0
  const actualAnswerRate = funnel.callsTotal > 0 ? answered / funnel.callsTotal : 0
  const actualCallbackRate = missed > 0 ? cbMade / missed : 0

  // 1. Losses from missed calls
  const lossMissed = missed * bench.bookingRateTarget * bench.showRateTarget * avgCheck

  // 2. Losses from no callback
  const notCalledBack = Math.max(0, missed - cbSuccess)
  const lossNoCallback = notCalledBack * bench.bookingRateCallback * bench.showRateTarget * avgCheck

  // 3. Losses from low conversion
  const conversionGap = Math.max(0, bench.bookingRateTarget - actualBookingRate)
  const lossLowConversion = answered * conversionGap * bench.showRateTarget * avgCheck

  // 4. Losses from no-show
  const lossNoShow = Math.max(0, booked - visited) * avgCheck

  const lossTotal = lossMissed + lossNoCallback + lossLowConversion + lossNoShow

  // Recovery forecasts
  const actionableCallbacks = Math.max(0, missed - cbMade)
  const recoveryMinimum = actionableCallbacks * bench.callbackSuccessRate * bench.bookingRateCallback * bench.showRateTarget * avgCheck
  const recoveryGood = recoveryMinimum + (answered * 0.10 * bench.showRateTarget * avgCheck)
  const recoveryExcellent = recoveryGood + (booked * 0.10 * avgCheck)

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

export interface LeakItem {
  id: string
  icon: string
  title: string
  lossAmount: number
  action: string
  severity: 'high' | 'medium' | 'low'
}

export function generateTopLeaks(funnel: FunnelData, bench: Benchmarks, losses: LossResult): LeakItem[] {
  const leaks: LeakItem[] = []
  const missed = funnel.callsMissed || 0
  const cbSuccess = funnel.callbacksSuccess || 0
  const notCalledBack = Math.max(0, missed - cbSuccess)

  if (notCalledBack > 0) {
    leaks.push({
      id: 'missed_no_callback',
      icon: '🔴',
      title: `${notCalledBack} пропущенных без перезвона`,
      lossAmount: losses.lossNoCallback,
      action: 'Назначить перезвон, дедлайн 12:00',
      severity: 'high',
    })
  }

  if (losses.metrics.bookingRate < bench.bookingRateTarget - 0.05) {
    const pct = Math.round(losses.metrics.bookingRate * 100)
    const target = Math.round(bench.bookingRateTarget * 100)
    leaks.push({
      id: 'low_conversion',
      icon: '🟠',
      title: `Конверсия ${pct}% (норма ${target}%)`,
      lossAmount: losses.lossLowConversion,
      action: 'Провести разбор звонков, проверить скрипты',
      severity: 'medium',
    })
  }

  if (losses.metrics.showRate < bench.showRateTarget - 0.05) {
    const pct = Math.round(losses.metrics.showRate * 100)
    const target = Math.round(bench.showRateTarget * 100)
    leaks.push({
      id: 'low_show_rate',
      icon: '🟡',
      title: `Доходимость ${pct}% (норма ${target}%)`,
      lossAmount: losses.lossNoShow,
      action: 'Включить подтверждение записей за 24ч',
      severity: 'medium',
    })
  }

  if (missed > 5) {
    leaks.push({
      id: 'missed_calls',
      icon: '🔴',
      title: `${missed} пропущенных звонков`,
      lossAmount: losses.lossMissed,
      action: 'Проверить загрузку операторов в пиковые часы',
      severity: 'high',
    })
  }

  if (losses.metrics.answerRate < bench.answerRateTarget - 0.05) {
    const pct = Math.round(losses.metrics.answerRate * 100)
    leaks.push({
      id: 'low_answer_rate',
      icon: '🟠',
      title: `% принятых ${pct}% — ниже нормы`,
      lossAmount: Math.round(losses.lossMissed * 0.5),
      action: 'Добавить оператора в пиковые часы',
      severity: 'medium',
    })
  }

  return leaks.sort((a, b) => b.lossAmount - a.lossAmount).slice(0, 5)
}

export function formatMoney(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} млн ₽`
  if (n >= 1000) return `${Math.round(n / 1000)} тыс. ₽`
  return `${Math.round(n)} ₽`
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`
}
