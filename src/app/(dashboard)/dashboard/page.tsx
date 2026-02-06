'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LossData {
  lossMissed: number
  lossNoCallback: number
  lossLowConversion: number
  lossNoShow: number
  lossTotal: number
  recoveryMinimum: number
  recoveryGood: number
  recoveryExcellent: number
}

interface FunnelData {
  callsTotal: number
  callsAnswered: number
  callsMissed: number
  booked: number
  visited: number
  avgCheck: number
  callbacksMade: number
  callbacksSuccess: number
}

interface TopLeak {
  icon: string
  title: string
  lossAmount: number
  action: string
  actionUrl?: string
}

interface DashboardData {
  period: string
  periodDays: number
  funnel: FunnelData
  losses: LossData
  metrics: Record<string, number>
  topLeaks: TopLeak[]
  changeVsPrev: number
  trend: Array<{
    date: string
    lossTotal: number
    lossMissed: number
    lossNoCallback: number
    lossLowConversion: number
    lossNoShow: number
  }>
  benchmarks: Record<string, number>
  hasFunnelData: boolean
}

type Period = 'today' | 'yesterday' | '7d' | '30d'

const periodLabels: Record<Period, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  '7d': '7 дней',
  '30d': '30 дней',
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%'
  return Math.round((value / total) * 100) + '%'
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

function LossCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('7d')

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/losses?period=${p}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка загрузки' }))
        throw new Error(err.error || 'Ошибка загрузки')
      }
      const json = await res.json()
      setData(json)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки данных'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [period, fetchData])

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
  }

  // Empty state
  if (!loading && data && !data.hasFunnelData) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Дашборд</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-6xl mb-4">{'\u{1F4CA}'}</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Нет данных для отображения</h2>
          <p className="text-gray-500 mb-6">Загрузите данные воронки, чтобы увидеть потери и возможности</p>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Загрузите данные {'\u{2192}'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

        {/* Period selector */}
        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <LossCardSkeleton />
            <LossCardSkeleton />
            <LossCardSkeleton />
            <LossCardSkeleton />
          </div>
          <Card className="mb-6">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-12 w-64 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-8 w-full mb-3" />
              <Skeleton className="h-8 w-full mb-3" />
              <Skeleton className="h-8 w-full mb-3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loaded content */}
      {!loading && data && (
        <>
          {/* Loss cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Missed */}
            <Card className="border-red-200">
              <CardContent className="p-5 bg-red-50 rounded-xl">
                <p className="text-sm font-medium text-red-700 mb-1">{'\u{1F4F5}'} Пропущенные</p>
                <p className="text-2xl font-bold text-red-600">{fmt(data.losses.lossMissed)} {'\u{20BD}'}</p>
              </CardContent>
            </Card>

            {/* No callback */}
            <Card className="border-orange-200">
              <CardContent className="p-5 bg-orange-50 rounded-xl">
                <p className="text-sm font-medium text-orange-700 mb-1">{'\u{1F504}'} Не перезвонили</p>
                <p className="text-2xl font-bold text-orange-600">{fmt(data.losses.lossNoCallback)} {'\u{20BD}'}</p>
              </CardContent>
            </Card>

            {/* Low conversion */}
            <Card className="border-yellow-200">
              <CardContent className="p-5 bg-yellow-50 rounded-xl">
                <p className="text-sm font-medium text-yellow-700 mb-1">{'\u{1F4C9}'} Низкая конверсия</p>
                <p className="text-2xl font-bold text-yellow-600">{fmt(data.losses.lossLowConversion)} {'\u{20BD}'}</p>
              </CardContent>
            </Card>

            {/* No show */}
            <Card className="border-gray-300">
              <CardContent className="p-5 bg-gray-100 rounded-xl">
                <p className="text-sm font-medium text-gray-700 mb-1">{'\u{1F6AB}'} Неявка</p>
                <p className="text-2xl font-bold text-gray-600">{fmt(data.losses.lossNoShow)} {'\u{20BD}'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Total loss card */}
          <Card className="mb-6 border-red-200">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">ИТОГО ПОТЕРЬ</p>
                  <p className="text-4xl font-bold text-red-600">{fmt(data.losses.lossTotal)} {'\u{20BD}'}</p>
                  {data.changeVsPrev !== 0 && (
                    <p className={`text-sm mt-1 ${data.changeVsPrev > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {data.changeVsPrev > 0 ? '\u{2191}' : '\u{2193}'} {Math.abs(data.changeVsPrev)}% vs предыдущий период
                    </p>
                  )}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4">
                  <p className="text-sm font-medium text-green-700 mb-1">Прогноз возврата</p>
                  <p className="text-2xl font-bold text-green-600">до +{fmt(data.losses.recoveryGood)} {'\u{20BD}'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Funnel section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{'\u{1F3AF}'} Воронка обращений</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Calls total */}
                <FunnelBar
                  label="Всего звонков"
                  value={data.funnel.callsTotal}
                  max={data.funnel.callsTotal}
                  color="bg-blue-500"
                  percentage="100%"
                />
                {/* Answered */}
                <FunnelBar
                  label="Принято"
                  value={data.funnel.callsAnswered}
                  max={data.funnel.callsTotal}
                  color="bg-blue-400"
                  percentage={pct(data.funnel.callsAnswered, data.funnel.callsTotal)}
                />
                {/* Booked */}
                <FunnelBar
                  label="Записано"
                  value={data.funnel.booked}
                  max={data.funnel.callsTotal}
                  color="bg-green-500"
                  percentage={pct(data.funnel.booked, data.funnel.callsTotal)}
                />
                {/* Visited */}
                <FunnelBar
                  label="Пришли"
                  value={data.funnel.visited}
                  max={data.funnel.callsTotal}
                  color="bg-green-600"
                  percentage={pct(data.funnel.visited, data.funnel.callsTotal)}
                />
              </div>

              {/* Conversion rates */}
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">% принятых</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {pct(data.funnel.callsAnswered, data.funnel.callsTotal)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Конверсия в запись</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {pct(data.funnel.booked, data.funnel.callsAnswered)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Доходимость</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {pct(data.funnel.visited, data.funnel.booked)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Перезвоны</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {data.funnel.callbacksMade} / {data.funnel.callsMissed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top leaks section */}
          {data.topLeaks && data.topLeaks.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{'\u{1F6A8}'} Главные утечки</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topLeaks.map((leak, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{leak.icon || '\u{26A0}\u{FE0F}'}</span>
                        <div>
                          <p className="font-medium text-gray-900">{leak.title}</p>
                          <p className="text-red-600 font-semibold">{fmt(leak.lossAmount)} {'\u{20BD}'}</p>
                        </div>
                      </div>
                      <Link
                        href={leak.actionUrl || '#'}
                        className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        {leak.action} {'\u{2192}'}
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forecast section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{'\u{1F4B0}'} Прогноз возврата</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-green-300" />
                    <span className="text-sm font-medium text-gray-700">Минимум (базовые действия)</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">+{fmt(data.losses.recoveryMinimum)} {'\u{20BD}'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-gray-700">Хороший (системная работа)</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">+{fmt(data.losses.recoveryGood)} {'\u{20BD}'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-green-100 rounded-lg border border-green-300">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-green-700" />
                    <span className="text-sm font-medium text-gray-700">Максимум (все рекомендации)</span>
                  </div>
                  <span className="text-xl font-bold text-green-700">+{fmt(data.losses.recoveryExcellent)} {'\u{20BD}'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function FunnelBar({
  label,
  value,
  max,
  color,
  percentage,
}: {
  label: string
  value: number
  max: number
  color: string
  percentage: string
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 sm:w-36 text-sm text-gray-600 shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${width}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-medium text-gray-900">
          {fmt(value)}
        </span>
      </div>
      <div className="w-14 text-sm font-semibold text-gray-700 text-right">{percentage}</div>
    </div>
  )
}
