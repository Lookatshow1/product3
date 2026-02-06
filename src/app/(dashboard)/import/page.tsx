'use client'

import { useState, useRef, DragEvent, FormEvent, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ImportResult {
  success: boolean
  validRows: number
  errorRows: number
  daysProcessed: number
}

interface FunnelResult {
  success: boolean
  losses: {
    lossMissed: number
    lossNoCallback: number
    lossLowConversion: number
    lossNoShow: number
    lossTotal: number
    recoveryMinimum: number
    recoveryGood: number
    recoveryExcellent: number
  }
}

/* ------------------------------------------------------------------ */
/*  Helper — format money                                              */
/* ------------------------------------------------------------------ */

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс. ₽`
  return `${Math.round(n)} ₽`
}

/* ------------------------------------------------------------------ */
/*  Helper — yesterday date as YYYY-MM-DD                              */
/* ------------------------------------------------------------------ */

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ImportPage() {
  /* ----- CSV upload state ----- */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState('')

  /* ----- Manual funnel state ----- */
  const [date, setDate] = useState(yesterdayStr())
  const [callsTotal, setCallsTotal] = useState<number | ''>('')
  const [callsAnswered, setCallsAnswered] = useState<number | ''>('')
  const [callsMissed, setCallsMissed] = useState<number | ''>('')
  const [booked, setBooked] = useState<number | ''>('')
  const [visited, setVisited] = useState<number | ''>('')
  const [avgCheck, setAvgCheck] = useState<number | ''>('')
  const [callbacksMade, setCallbacksMade] = useState<number | ''>('')
  const [callbacksSuccess, setCallbacksSuccess] = useState<number | ''>('')
  const [funnelLoading, setFunnelLoading] = useState(false)
  const [funnelResult, setFunnelResult] = useState<FunnelResult | null>(null)
  const [funnelError, setFunnelError] = useState('')

  /* ----- Drag & drop handlers ----- */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setCsvResult(null)
      setCsvError('')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setCsvResult(null)
      setCsvError('')
    }
  }, [])

  /* ----- CSV upload ----- */
  async function handleCsvUpload() {
    if (!selectedFile) return
    setCsvUploading(true)
    setCsvError('')
    setCsvResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/import/journal', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setCsvError(data.error || 'Ошибка загрузки файла')
        toast.error(data.error || 'Ошибка загрузки файла')
        return
      }

      setCsvResult({
        success: true,
        validRows: data.validRows,
        errorRows: data.errorRows,
        daysProcessed: data.daysProcessed,
      })
      toast.success(`Импортировано: ${data.validRows} строк за ${data.daysProcessed} дней`)
    } catch {
      setCsvError('Ошибка сети. Попробуйте позже.')
      toast.error('Ошибка сети')
    } finally {
      setCsvUploading(false)
    }
  }

  /* ----- Manual funnel submit ----- */
  async function handleFunnelSubmit(e: FormEvent) {
    e.preventDefault()
    setFunnelLoading(true)
    setFunnelError('')
    setFunnelResult(null)

    try {
      const res = await fetch('/api/import/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          callsTotal: Number(callsTotal) || 0,
          callsAnswered: Number(callsAnswered) || 0,
          callsMissed: Number(callsMissed) || 0,
          booked: Number(booked) || 0,
          visited: Number(visited) || 0,
          avgCheck: avgCheck !== '' ? Number(avgCheck) : undefined,
          callbacksMade: callbacksMade !== '' ? Number(callbacksMade) : undefined,
          callbacksSuccess: callbacksSuccess !== '' ? Number(callbacksSuccess) : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFunnelError(data.error || 'Ошибка сохранения')
        toast.error(data.error || 'Ошибка сохранения')
        return
      }

      setFunnelResult({ success: true, losses: data.losses })
      toast.success('Данные воронки сохранены')
    } catch {
      setFunnelError('Ошибка сети. Попробуйте позже.')
      toast.error('Ошибка сети')
    } finally {
      setFunnelLoading(false)
    }
  }

  /* ----- Render ----- */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Импорт данных</h1>
        <p className="mt-1 text-sm text-gray-500">
          Загрузите журнал обращений или введите данные воронки вручную
        </p>
      </div>

      {/* Two cards side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ---- Card 1: CSV Upload ---- */}
        <Card>
          <CardHeader>
            <CardTitle>CSV/Excel журнал обращений</CardTitle>
            <CardDescription>
              Загрузите файл с данными звонков для автоматического анализа
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag-and-drop area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? 'border-[#2563eb] bg-blue-50'
                  : selectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <>
                  <svg className="mb-2 h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </>
              ) : (
                <>
                  <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">
                    Перетащите файл сюда или нажмите для выбора
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Поддерживаются .csv и .xlsx</p>
                </>
              )}
            </div>

            {/* Upload button */}
            <Button
              onClick={handleCsvUpload}
              disabled={!selectedFile || csvUploading}
              className="w-full"
            >
              {csvUploading ? 'Загрузка...' : 'Загрузить и обработать'}
            </Button>

            {/* CSV Error */}
            {csvError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {csvError}
              </div>
            )}

            {/* CSV Result */}
            {csvResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="font-medium text-green-800">Импорт завершён</p>
                <div className="mt-2 space-y-1 text-sm text-green-700">
                  <p>Валидных строк: <span className="font-semibold">{csvResult.validRows}</span></p>
                  <p>Ошибок: <span className="font-semibold">{csvResult.errorRows}</span></p>
                  <p>Дней обработано: <span className="font-semibold">{csvResult.daysProcessed}</span></p>
                </div>
              </div>
            )}

            {/* Template download link */}
            <div className="text-center">
              <a
                href="/templates/journal-template.csv"
                className="text-sm font-medium text-[#2563eb] hover:underline"
              >
                Скачать шаблон CSV
              </a>
            </div>
          </CardContent>
        </Card>

        {/* ---- Card 2: Manual Funnel Entry ---- */}
        <Card>
          <CardHeader>
            <CardTitle>Воронка дня (ввод вручную)</CardTitle>
            <CardDescription>
              Введите итоговые показатели за день
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFunnelSubmit} className="space-y-4">
              {/* Date */}
              <Input
                label="Дата"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />

              {/* Two-column grid for numeric fields */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Всего звонков"
                  type="number"
                  min={0}
                  value={callsTotal}
                  onChange={(e) => setCallsTotal(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
                <Input
                  label="Принято"
                  type="number"
                  min={0}
                  value={callsAnswered}
                  onChange={(e) => setCallsAnswered(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
                <Input
                  label="Пропущено"
                  type="number"
                  min={0}
                  value={callsMissed}
                  onChange={(e) => setCallsMissed(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
                <Input
                  label="Записано"
                  type="number"
                  min={0}
                  value={booked}
                  onChange={(e) => setBooked(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
                <Input
                  label="Пришли"
                  type="number"
                  min={0}
                  value={visited}
                  onChange={(e) => setVisited(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
                <Input
                  label="Средний чек ₽"
                  type="number"
                  min={0}
                  step={100}
                  value={avgCheck}
                  onChange={(e) => setAvgCheck(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Из настроек"
                />
                <Input
                  label="Перезвонов"
                  type="number"
                  min={0}
                  value={callbacksMade}
                  onChange={(e) => setCallbacksMade(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                />
                <Input
                  label="Успешных перезвонов"
                  type="number"
                  min={0}
                  value={callbacksSuccess}
                  onChange={(e) => setCallbacksSuccess(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={funnelLoading}>
                {funnelLoading ? 'Сохранение...' : 'Сохранить воронку'}
              </Button>

              {/* Error */}
              {funnelError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {funnelError}
                </div>
              )}

              {/* Result */}
              {funnelResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="font-medium text-green-800">Данные сохранены</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Потери от пропущенных:</span>
                      <span className="font-semibold text-red-600">
                        {fmtMoney(funnelResult.losses.lossMissed)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Потери без перезвона:</span>
                      <span className="font-semibold text-red-600">
                        {fmtMoney(funnelResult.losses.lossNoCallback)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Потери конверсии:</span>
                      <span className="font-semibold text-red-600">
                        {fmtMoney(funnelResult.losses.lossLowConversion)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Потери неявка:</span>
                      <span className="font-semibold text-red-600">
                        {fmtMoney(funnelResult.losses.lossNoShow)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-green-200 pt-2">
                      <span className="font-medium text-gray-900">Итого потерь:</span>
                      <span className="text-lg font-bold text-red-600">
                        {fmtMoney(funnelResult.losses.lossTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Можно вернуть (мин.):</span>
                      <span className="font-semibold text-green-600">
                        +{fmtMoney(funnelResult.losses.recoveryMinimum)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="mt-4 inline-flex items-center text-sm font-medium text-[#2563eb] hover:underline"
                  >
                    Перейти к дашборду &rarr;
                  </Link>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ---- Recent imports table ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Последние импорты</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">Тип</th>
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">Файл</th>
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">Строк</th>
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">Ошибок</th>
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">Статус</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Дата</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {csvResult ? (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-[#2563eb]">
                        CSV
                      </span>
                    </td>
                    <td className="py-3 pr-4">{selectedFile?.name || '---'}</td>
                    <td className="py-3 pr-4">{csvResult.validRows}</td>
                    <td className="py-3 pr-4">{csvResult.errorRows}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Завершён
                      </span>
                    </td>
                    <td className="py-3">{new Date().toLocaleDateString('ru-RU')}</td>
                  </tr>
                ) : funnelResult ? (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        Ручной
                      </span>
                    </td>
                    <td className="py-3 pr-4">Воронка за {date}</td>
                    <td className="py-3 pr-4">1</td>
                    <td className="py-3 pr-4">0</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Завершён
                      </span>
                    </td>
                    <td className="py-3">{new Date().toLocaleDateString('ru-RU')}</td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      Нет импортов. Загрузите файл или введите данные вручную.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
