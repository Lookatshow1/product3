'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const clinicTypes = [
  { value: 'dental', label: 'Стоматология' },
  { value: 'cosmetology', label: 'Косметология' },
  { value: 'multi', label: 'Многопрофильная клиника' },
  { value: 'other', label: 'Другое' },
] as const

const timezones = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const [clinicName, setClinicName] = useState('Моя клиника')
  const [clinicType, setClinicType] = useState('dental')
  const [chairsCount, setChairsCount] = useState(3)
  const [avgCheck, setAvgCheck] = useState(5000)
  const [timezone, setTimezone] = useState('Europe/Moscow')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName,
          clinicType,
          chairsCount,
          avgCheck,
          timezone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить данные. Попробуйте снова.')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Ошибка сети. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4">
          <h1 className="text-xl font-bold text-[#2563eb]">CallFlow OS</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Title */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Настройте клинику за 2 минуты
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Заполните основную информацию о вашей клинике
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Clinic Name */}
            <Input
              label="Название клиники"
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              required
            />

            {/* Clinic Type */}
            <div className="w-full">
              <label
                htmlFor="clinicType"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Тип клиники
              </label>
              <select
                id="clinicType"
                value={clinicType}
                onChange={(e) => setClinicType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {clinicTypes.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Chairs Count */}
              <Input
                label="Количество кресел"
                type="number"
                min={1}
                value={chairsCount}
                onChange={(e) => setChairsCount(Number(e.target.value))}
                required
              />

              {/* Average Check */}
              <Input
                label="Средний чек, ₽"
                type="number"
                min={0}
                step={100}
                value={avgCheck}
                onChange={(e) => setAvgCheck(Number(e.target.value))}
                required
              />
            </div>

            {/* Timezone */}
            <div className="w-full">
              <label
                htmlFor="timezone"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Часовой пояс
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Завершить настройку'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
