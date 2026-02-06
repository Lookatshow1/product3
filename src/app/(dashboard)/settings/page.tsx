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

interface Clinic {
  id: string
  name: string
  type: string
  chairsCount: number
  avgCheck: number
  timezone: string
  workStart: string
  workEnd: string
  privacyMode: string
}

interface Benchmarks {
  answerRateTarget: number
  bookingRateTarget: number
  showRateTarget: number
  callbackSuccessRate: number
  bookingRateCallback: number
  avgMargin: number
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const clinicTypes = [
  { value: 'dental', label: 'Стоматология' },
  { value: 'cosmetology', label: 'Косметология' },
  { value: 'multi', label: 'Многопрофильная клиника' },
  { value: 'other', label: 'Другое' },
]

const timezones = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
]

const roles = [
  { value: 'owner', label: 'Владелец' },
  { value: 'manager', label: 'Руководитель' },
  { value: 'admin', label: 'Администратор' },
  { value: 'viewer', label: 'Наблюдатель' },
]

const DEFAULT_BENCHMARKS: Benchmarks = {
  answerRateTarget: 0.9,
  bookingRateTarget: 0.55,
  showRateTarget: 0.85,
  callbackSuccessRate: 0.6,
  bookingRateCallback: 0.35,
  avgMargin: 0.6,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const selectClasses =
  'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20'

function roleLabel(role: string): string {
  return roles.find((r) => r.value === role)?.label || role
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Никогда'
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

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<'clinic' | 'benchmarks' | 'users' | 'privacy'>('clinic')

  /* ================================================================ */
  /*  Section 1: Clinic                                                */
  /* ================================================================ */
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [clinicLoading, setClinicLoading] = useState(true)
  const [clinicSaving, setClinicSaving] = useState(false)

  // Clinic form fields
  const [clinicName, setClinicName] = useState('')
  const [clinicType, setClinicType] = useState('dental')
  const [chairsCount, setChairsCount] = useState(3)
  const [clinicAvgCheck, setClinicAvgCheck] = useState(5000)
  const [timezone, setTimezone] = useState('Europe/Moscow')
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('21:00')

  useEffect(() => {
    async function loadClinic() {
      try {
        const res = await fetch('/api/settings/clinic')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        const c = data.clinic
        if (c) {
          setClinic(c)
          setClinicName(c.name || '')
          setClinicType(c.type || 'dental')
          setChairsCount(c.chairsCount || 3)
          setClinicAvgCheck(c.avgCheck || 5000)
          setTimezone(c.timezone || 'Europe/Moscow')
          setWorkStart(c.workStart || '09:00')
          setWorkEnd(c.workEnd || '21:00')
        }
      } catch {
        toast.error('Не удалось загрузить данные клиники')
      } finally {
        setClinicLoading(false)
      }
    }
    loadClinic()
  }, [])

  async function handleClinicSave(e: FormEvent) {
    e.preventDefault()
    setClinicSaving(true)
    try {
      const res = await fetch('/api/settings/clinic', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clinicName,
          type: clinicType,
          chairsCount,
          avgCheck: clinicAvgCheck,
          timezone,
          workStart,
          workEnd,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка сохранения')
        return
      }
      setClinic(data.clinic)
      toast.success('Настройки клиники сохранены')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setClinicSaving(false)
    }
  }

  /* ================================================================ */
  /*  Section 2: Benchmarks                                            */
  /* ================================================================ */
  const [benchmarks, setBenchmarks] = useState<Benchmarks>(DEFAULT_BENCHMARKS)
  const [benchLoading, setBenchLoading] = useState(true)
  const [benchSaving, setBenchSaving] = useState(false)

  // Benchmark form fields (stored as percentages in UI, 0-1 for API)
  const [answerRatePct, setAnswerRatePct] = useState(90)
  const [bookingRatePct, setBookingRatePct] = useState(55)
  const [showRatePct, setShowRatePct] = useState(85)
  const [callbackSuccessPct, setCallbackSuccessPct] = useState(60)
  const [bookingRateCallbackPct, setBookingRateCallbackPct] = useState(35)
  const [avgMarginPct, setAvgMarginPct] = useState(60)

  useEffect(() => {
    async function loadBenchmarks() {
      try {
        const res = await fetch('/api/settings/benchmarks')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        const b = data.benchmarks
        if (b) {
          setBenchmarks(b)
          setAnswerRatePct(Math.round(b.answerRateTarget * 100))
          setBookingRatePct(Math.round(b.bookingRateTarget * 100))
          setShowRatePct(Math.round(b.showRateTarget * 100))
          setCallbackSuccessPct(Math.round(b.callbackSuccessRate * 100))
          setBookingRateCallbackPct(Math.round(b.bookingRateCallback * 100))
          setAvgMarginPct(Math.round(b.avgMargin * 100))
        }
      } catch {
        toast.error('Не удалось загрузить коэффициенты')
      } finally {
        setBenchLoading(false)
      }
    }
    loadBenchmarks()
  }, [])

  async function handleBenchmarksSave(e: FormEvent) {
    e.preventDefault()
    setBenchSaving(true)
    try {
      const payload = {
        answerRateTarget: answerRatePct / 100,
        bookingRateTarget: bookingRatePct / 100,
        showRateTarget: showRatePct / 100,
        callbackSuccessRate: callbackSuccessPct / 100,
        bookingRateCallback: bookingRateCallbackPct / 100,
        avgMargin: avgMarginPct / 100,
      }
      const res = await fetch('/api/settings/benchmarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка сохранения')
        return
      }
      setBenchmarks(data.benchmarks)
      toast.success('Коэффициенты сохранены')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setBenchSaving(false)
    }
  }

  function handleResetDefaults() {
    setAnswerRatePct(Math.round(DEFAULT_BENCHMARKS.answerRateTarget * 100))
    setBookingRatePct(Math.round(DEFAULT_BENCHMARKS.bookingRateTarget * 100))
    setShowRatePct(Math.round(DEFAULT_BENCHMARKS.showRateTarget * 100))
    setCallbackSuccessPct(Math.round(DEFAULT_BENCHMARKS.callbackSuccessRate * 100))
    setBookingRateCallbackPct(Math.round(DEFAULT_BENCHMARKS.bookingRateCallback * 100))
    setAvgMarginPct(Math.round(DEFAULT_BENCHMARKS.avgMargin * 100))
    toast.success('Коэффициенты сброшены к дефолтам. Нажмите "Сохранить" для применения.')
  }

  /* ================================================================ */
  /*  Section 3: Users                                                 */
  /* ================================================================ */
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Invite form
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('admin')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/users/invite')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setUsers(data.users || [])
      } catch {
        toast.error('Не удалось загрузить пользователей')
      } finally {
        setUsersLoading(false)
      }
    }
    loadUsers()
  }, [])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          password: invitePassword || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка приглашения')
        return
      }

      toast.success('Пользователь приглашён')
      // Add to list
      if (data.user) {
        setUsers((prev) => [
          ...prev,
          {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            isActive: true,
            lastLoginAt: null,
          },
        ])
      }

      // Reset form
      setInviteName('')
      setInviteEmail('')
      setInviteRole('admin')
      setInvitePassword('')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setInviting(false)
    }
  }

  /* ================================================================ */
  /*  Section 4: Privacy                                               */
  /* ================================================================ */
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function handleDeleteAll(e: FormEvent) {
    e.preventDefault()
    if (!clinic) return
    if (confirmName !== clinic.name) {
      toast.error('Название клиники не совпадает')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationName: confirmName }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка удаления')
        return
      }

      toast.success('Все данные удалены')
      setShowDeleteConfirm(false)
      setConfirmName('')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setDeleting(false)
    }
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="mt-1 text-sm text-gray-500">
          Управление клиникой, коэффициентами, пользователями и данными
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { key: 'clinic' as const, label: 'Клиника' },
          { key: 'benchmarks' as const, label: 'Коэффициенты' },
          { key: 'users' as const, label: 'Пользователи' },
          { key: 'privacy' as const, label: 'Данные и приватность' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeSection === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  Section: Клиника                                             */}
      {/* ============================================================ */}
      {activeSection === 'clinic' && (
        <Card>
          <CardHeader>
            <CardTitle>Клиника</CardTitle>
            <CardDescription>Основная информация о вашей клинике</CardDescription>
          </CardHeader>
          <CardContent>
            {clinicLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563eb]" />
              </div>
            ) : (
              <form onSubmit={handleClinicSave} className="space-y-5">
                <Input
                  label="Название клиники"
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  required
                />

                <div className="w-full">
                  <label htmlFor="clinicType" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Тип клиники
                  </label>
                  <select
                    id="clinicType"
                    value={clinicType}
                    onChange={(e) => setClinicType(e.target.value)}
                    className={selectClasses}
                  >
                    {clinicTypes.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input
                    label="Количество кресел"
                    type="number"
                    min={1}
                    value={chairsCount}
                    onChange={(e) => setChairsCount(Number(e.target.value))}
                    required
                  />
                  <Input
                    label="Средний чек, ₽"
                    type="number"
                    min={0}
                    step={100}
                    value={clinicAvgCheck}
                    onChange={(e) => setClinicAvgCheck(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="w-full">
                  <label htmlFor="timezone" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Часовой пояс
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={selectClasses}
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input
                    label="Начало работы"
                    type="time"
                    value={workStart}
                    onChange={(e) => setWorkStart(e.target.value)}
                    required
                  />
                  <Input
                    label="Конец работы"
                    type="time"
                    value={workEnd}
                    onChange={(e) => setWorkEnd(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" disabled={clinicSaving}>
                  {clinicSaving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Section: Коэффициенты                                        */}
      {/* ============================================================ */}
      {activeSection === 'benchmarks' && (
        <Card>
          <CardHeader>
            <CardTitle>Коэффициенты</CardTitle>
            <CardDescription>
              Целевые показатели для расчёта потерь. Значения указываются в процентах.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {benchLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563eb]" />
              </div>
            ) : (
              <form onSubmit={handleBenchmarksSave} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Целевой % принятых звонков
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={answerRatePct}
                        onChange={(e) => setAnswerRatePct(Number(e.target.value))}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Целевой % записи
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={bookingRatePct}
                        onChange={(e) => setBookingRatePct(Number(e.target.value))}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Целевая доходимость
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={showRatePct}
                        onChange={(e) => setShowRatePct(Number(e.target.value))}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      % успешных перезвонов
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={callbackSuccessPct}
                        onChange={(e) => setCallbackSuccessPct(Number(e.target.value))}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      % записи из перезвонов
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={bookingRateCallbackPct}
                        onChange={(e) => setBookingRateCallbackPct(Number(e.target.value))}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Средняя маржинальность
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={avgMarginPct}
                        onChange={(e) => setAvgMarginPct(Number(e.target.value))}
                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Button type="submit" disabled={benchSaving}>
                    {benchSaving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResetDefaults}>
                    Сбросить к дефолтам
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Section: Пользователи                                        */}
      {/* ============================================================ */}
      {activeSection === 'users' && (
        <div className="space-y-6">
          {/* Users table */}
          <Card>
            <CardHeader>
              <CardTitle>Пользователи</CardTitle>
              <CardDescription>Список пользователей с доступом к системе</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563eb]" />
                </div>
              ) : users.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  Пользователи не найдены.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 pr-4 text-left font-medium text-gray-500">Имя</th>
                        <th className="pb-3 pr-4 text-left font-medium text-gray-500">Email</th>
                        <th className="pb-3 pr-4 text-left font-medium text-gray-500">Роль</th>
                        <th className="pb-3 text-left font-medium text-gray-500">Последний вход</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-100">
                          <td className="py-3 pr-4">
                            <div className="flex items-center space-x-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                                {user.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-gray-500">{user.email}</td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={
                                user.role === 'owner'
                                  ? 'default'
                                  : user.role === 'manager'
                                    ? 'success'
                                    : 'outline'
                              }
                            >
                              {roleLabel(user.role)}
                            </Badge>
                          </td>
                          <td className="py-3 text-gray-500">
                            {formatDateTime(user.lastLoginAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invite form */}
          <Card>
            <CardHeader>
              <CardTitle>Пригласить пользователя</CardTitle>
              <CardDescription>Добавьте нового пользователя в систему</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input
                    label="Имя"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    placeholder="Иван Иванов"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="w-full">
                    <label htmlFor="inviteRole" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Роль
                    </label>
                    <select
                      id="inviteRole"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className={selectClasses}
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Пароль"
                    type="password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Оставьте пустым для авто"
                  />
                </div>

                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Приглашение...' : 'Пригласить'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Section: Данные и приватность                                 */}
      {/* ============================================================ */}
      {activeSection === 'privacy' && (
        <div className="space-y-6">
          {/* Current mode */}
          <Card>
            <CardHeader>
              <CardTitle>Режим данных</CardTitle>
              <CardDescription>
                Текущий режим обработки персональных данных
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <Badge variant={clinic?.privacyMode === 'personal' ? 'warning' : 'success'}>
                  {clinic?.privacyMode === 'personal' ? 'Персональные данные' : 'Анонимный режим'}
                </Badge>
                <span className="text-sm text-gray-500">
                  {clinic?.privacyMode === 'personal'
                    ? 'Данные пациентов хранятся с персональной информацией.'
                    : 'Все данные обрабатываются в анонимном режиме. ID пациентов хешируются.'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Delete all data */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Удалить все данные</CardTitle>
              <CardDescription>
                Это действие необратимо. Все импорты, воронки, задачи и отчёты будут удалены.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showDeleteConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Удалить все данные
                </Button>
              ) : (
                <form onSubmit={handleDeleteAll} className="space-y-4">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800">
                      Для подтверждения введите название вашей клиники:{' '}
                      <strong>{clinic?.name || '...'}</strong>
                    </p>
                  </div>

                  <Input
                    label="Название клиники"
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={clinic?.name || 'Введите название'}
                    required
                  />

                  <div className="flex items-center space-x-3">
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={deleting || confirmName !== clinic?.name}
                    >
                      {deleting ? 'Удаление...' : 'Подтвердить удаление'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setConfirmName('')
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
