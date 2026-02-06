'use client'

import { useState, useEffect, FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Report {
  id: string
  type: string
  format: string
  periodStart: string
  periodEnd: string
  status: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

function defaultEndDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function reportTypeLabel(type: string): string {
  switch (type) {
    case 'owner_summary':
      return 'Для собственника'
    case 'manager_detailed':
      return 'Для руководителя'
    default:
      return type
  }
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  /* ----- Form state ----- */
  const [periodStart, setPeriodStart] = useState(defaultStartDate())
  const [periodEnd, setPeriodEnd] = useState(defaultEndDate())
  const [reportType, setReportType] = useState<'owner_summary' | 'manager_detailed'>('owner_summary')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  /* ----- Reports list state ----- */
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)

  /* ----- Load past reports ----- */
  useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch('/api/reports/generate')
        if (!res.ok) throw new Error('Failed to load reports')
        const data = await res.json()
        setReports(data.reports || [])
      } catch {
        toast.error('Не удалось загрузить отчёты')
      } finally {
        setReportsLoading(false)
      }
    }

    loadReports()
  }, [])

  /* ----- Generate report ----- */
  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          periodStart,
          periodEnd,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Ошибка генерации отчёта')
        toast.error(data.error || 'Ошибка генерации отчёта')
        return
      }

      toast.success('Отчёт сформирован')

      // Open the HTML report in a new window
      if (data.html) {
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(data.html)
          newWindow.document.close()
        } else {
          toast.error('Браузер заблокировал всплывающее окно. Разрешите pop-up для этого сайта.')
        }
      }

      // Add the new report to the list
      if (data.report) {
        setReports((prev) => [data.report, ...prev])
      }
    } catch {
      setError('Ошибка сети. Попробуйте позже.')
      toast.error('Ошибка сети')
    } finally {
      setGenerating(false)
    }
  }

  /* ----- Render ----- */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Отчёты</h1>
        <p className="mt-1 text-sm text-gray-500">
          Формируйте отчёты по потерям и эффективности за любой период
        </p>
      </div>

      {/* Generate report card */}
      <Card>
        <CardHeader>
          <CardTitle>Создать отчёт</CardTitle>
          <CardDescription>
            Выберите период и тип отчёта для генерации
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Period */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Начало периода"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
              <Input
                label="Конец периода"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>

            {/* Report type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Тип отчёта
              </label>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-6 sm:space-y-0">
                <label className="flex cursor-pointer items-center space-x-3">
                  <input
                    type="radio"
                    name="reportType"
                    value="owner_summary"
                    checked={reportType === 'owner_summary'}
                    onChange={() => setReportType('owner_summary')}
                    className="h-4 w-4 text-[#2563eb] focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Для собственника</span>
                    <p className="text-xs text-gray-500">Итоги, потери, прогноз возврата</p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center space-x-3">
                  <input
                    type="radio"
                    name="reportType"
                    value="manager_detailed"
                    checked={reportType === 'manager_detailed'}
                    onChange={() => setReportType('manager_detailed')}
                    className="h-4 w-4 text-[#2563eb] focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Для руководителя</span>
                    <p className="text-xs text-gray-500">Детальная разбивка по дням и метрикам</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit button */}
            <Button type="submit" disabled={generating} size="lg">
              {generating ? (
                <span className="flex items-center space-x-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Генерация...</span>
                </span>
              ) : (
                'Сгенерировать'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Past reports table */}
      <Card>
        <CardHeader>
          <CardTitle>История отчётов</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563eb]" />
            </div>
          ) : reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Отчёты ещё не создавались.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 pr-4 text-left font-medium text-gray-500">Тип</th>
                    <th className="pb-3 pr-4 text-left font-medium text-gray-500">Период</th>
                    <th className="pb-3 pr-4 text-left font-medium text-gray-500">Формат</th>
                    <th className="pb-3 pr-4 text-left font-medium text-gray-500">Статус</th>
                    <th className="pb-3 text-left font-medium text-gray-500">Создан</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4">
                        <span className="font-medium">{reportTypeLabel(report.type)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        {formatDate(report.periodStart)} &mdash; {formatDate(report.periodEnd)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">
                          {(report.format || 'html').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={report.status === 'ready' ? 'success' : 'warning'}>
                          {report.status === 'ready' ? 'Готов' : 'Обработка'}
                        </Badge>
                      </td>
                      <td className="py-3">{formatDateTime(report.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
