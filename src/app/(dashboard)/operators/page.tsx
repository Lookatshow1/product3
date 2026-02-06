'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface OperatorRanking {
  id: string
  name: string
  shifts: number
  totalCalls: number
  answered: number
  answerRate: number
  booked: number
  bookingRate: number
  avgDuration: number
  shortCalls: number
  shortCallPct: number
  score: number
}

interface Anomaly {
  type: string
  severity: string
  entityType: string
  entityName: string
  message: string
  suggestion: string
}

interface StoredAnomaly {
  id: string
  type: string
  severity: string
  entityType: string
  entityName: string
  message: string
  suggestion: string
  isAcknowledged: boolean
  detectedAt: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass: string
  let variant: 'success' | 'warning' | 'destructive'

  if (score > 75) {
    colorClass = 'text-green-700'
    variant = 'success'
  } else if (score >= 50) {
    colorClass = 'text-yellow-700'
    variant = 'warning'
  } else {
    colorClass = 'text-red-700'
    variant = 'destructive'
  }

  return (
    <Badge variant={variant} className={colorClass}>
      {score}
    </Badge>
  )
}

function BookingRateCell({ rate }: { rate: number }) {
  let colorClass: string
  if (rate > 55) {
    colorClass = 'text-green-600 font-semibold'
  } else if (rate >= 35) {
    colorClass = 'text-yellow-600 font-semibold'
  } else {
    colorClass = 'text-red-600 font-semibold'
  }

  return <span className={colorClass}>{rate}%</span>
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<OperatorRanking[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [storedAnomalies, setStoredAnomalies] = useState<StoredAnomaly[]>([])
  const [loadingOps, setLoadingOps] = useState(true)
  const [loadingAnom, setLoadingAnom] = useState(true)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  const fetchOperators = useCallback(async () => {
    setLoadingOps(true)
    try {
      const res = await fetch('/api/operators/ranking')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка загрузки' }))
        throw new Error(err.error || 'Ошибка загрузки')
      }
      const json = await res.json()
      setOperators(json.operators || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки операторов'
      toast.error(message)
    } finally {
      setLoadingOps(false)
    }
  }, [])

  const fetchAnomalies = useCallback(async () => {
    setLoadingAnom(true)
    try {
      const res = await fetch('/api/anomalies')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка загрузки' }))
        throw new Error(err.error || 'Ошибка загрузки')
      }
      const json = await res.json()
      setAnomalies(json.anomalies || [])
      setStoredAnomalies(json.stored || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки аномалий'
      toast.error(message)
    } finally {
      setLoadingAnom(false)
    }
  }, [])

  useEffect(() => {
    fetchOperators()
    fetchAnomalies()
  }, [fetchOperators, fetchAnomalies])

  const acknowledgeAnomaly = async (anomalyId: string) => {
    setAcknowledging(anomalyId)
    try {
      const res = await fetch('/api/anomalies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: anomalyId, isAcknowledged: true }),
      })
      if (!res.ok) {
        throw new Error('Ошибка подтверждения')
      }
      toast.success('Аномалия подтверждена')
      setStoredAnomalies((prev) =>
        prev.map((a) => (a.id === anomalyId ? { ...a, isAcknowledged: true } : a))
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка подтверждения аномалии'
      toast.error(message)
    } finally {
      setAcknowledging(null)
    }
  }

  // Empty state
  if (!loadingOps && operators.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Операторы</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-6xl mb-4">{'\u{1F465}'}</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Нет данных по операторам</h2>
          <p className="text-gray-500 mb-6">Загрузите журнал обращений с именами операторов</p>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Загрузите журнал обращений с именами операторов {'\u{2192}'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Операторы</h1>

      {/* Operators table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{'\u{1F465}'} Рейтинг операторов</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOps ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">#</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Оператор</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">Смен</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">Принятых</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">% принятых</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">Записей</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">Конверсия</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">Ср. длит.</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op, idx) => (
                    <tr
                      key={op.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        idx < 3 ? 'bg-green-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-2 text-gray-500 font-medium">
                        {idx + 1}
                        {idx === 0 && ' \u{1F947}'}
                        {idx === 1 && ' \u{1F948}'}
                        {idx === 2 && ' \u{1F949}'}
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-900">{op.name}</td>
                      <td className="py-3 px-2 text-center text-gray-700">{op.shifts}</td>
                      <td className="py-3 px-2 text-center text-gray-700">
                        {op.answered}
                        <span className="text-gray-400 text-xs"> / {op.totalCalls}</span>
                      </td>
                      <td className="py-3 px-2 text-center text-gray-700">{op.answerRate}%</td>
                      <td className="py-3 px-2 text-center text-gray-700">{op.booked}</td>
                      <td className="py-3 px-2 text-center">
                        <BookingRateCell rate={op.bookingRate} />
                      </td>
                      <td className="py-3 px-2 text-center text-gray-700">{formatDuration(op.avgDuration)}</td>
                      <td className="py-3 px-2 text-center">
                        <ScoreBadge score={op.score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomalies section */}
      <Card>
        <CardHeader>
          <CardTitle>{'\u{1F6A8}'} Аномалии</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAnom ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : anomalies.length === 0 && storedAnomalies.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">{'\u{2705}'}</div>
              <p className="text-gray-500">Аномалий не обнаружено</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Live-detected anomalies */}
              {anomalies.map((anomaly, idx) => (
                <div
                  key={`live-${idx}`}
                  className={`p-4 rounded-lg border ${
                    anomaly.severity === 'high'
                      ? 'bg-red-50 border-red-200'
                      : anomaly.severity === 'medium'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={anomaly.severity === 'high' ? 'destructive' : 'warning'}
                        >
                          {anomaly.severity === 'high' ? 'Критично' : anomaly.severity === 'medium' ? 'Внимание' : 'Инфо'}
                        </Badge>
                        <span className="text-sm font-semibold text-gray-900">{anomaly.entityName}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{anomaly.message}</p>
                      <p className="text-xs text-gray-500">
                        {'\u{1F4A1}'} {anomaly.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Stored anomalies */}
              {storedAnomalies
                .filter((a) => !a.isAcknowledged)
                .map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`p-4 rounded-lg border ${
                      anomaly.severity === 'high'
                        ? 'bg-red-50 border-red-200'
                        : anomaly.severity === 'medium'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={anomaly.severity === 'high' ? 'destructive' : 'warning'}
                          >
                            {anomaly.severity === 'high' ? 'Критично' : anomaly.severity === 'medium' ? 'Внимание' : 'Инфо'}
                          </Badge>
                          <span className="text-sm font-semibold text-gray-900">{anomaly.entityName}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(anomaly.detectedAt).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{anomaly.message}</p>
                        <p className="text-xs text-gray-500">
                          {'\u{1F4A1}'} {anomaly.suggestion}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAnomaly(anomaly.id)}
                        disabled={acknowledging === anomaly.id}
                        className="shrink-0"
                      >
                        {acknowledging === anomaly.id ? '...' : 'Подтвердить'}
                      </Button>
                    </div>
                  </div>
                ))}

              {/* Acknowledged anomalies (collapsed) */}
              {storedAnomalies.filter((a) => a.isAcknowledged).length > 0 && (
                <AcknowledgedSection anomalies={storedAnomalies.filter((a) => a.isAcknowledged)} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AcknowledgedSection({ anomalies }: { anomalies: StoredAnomaly[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Подтверждённые ({anomalies.length})
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className="p-3 rounded-lg bg-gray-50 border border-gray-100 opacity-70"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">Подтверждено</Badge>
                <span className="text-sm font-medium text-gray-600">{anomaly.entityName}</span>
              </div>
              <p className="text-sm text-gray-500">{anomaly.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
