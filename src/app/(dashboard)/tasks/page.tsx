'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

interface Task {
  id: string
  type: string
  description: string
  priority: string
  status: string
  result: string | null
  comment: string | null
  date: string
  assignedOp: { id: string; name: string } | null
  postponedTo: string | null
  completedAt: string | null
}

interface TaskSummary {
  total: number
  completed: number
  progressPct: number
  byType: Record<string, { count: number; completed: number }>
}

interface TasksResponse {
  tasks: Task[]
  summary: TaskSummary
}

const typeConfig: Record<string, { label: string; icon: string }> = {
  callback: { label: 'Перезвоны', icon: '\u{1F4DE}' },
  confirm_booking: { label: 'Подтверждения', icon: '\u{2705}' },
  reschedule: { label: 'Удержание отмен', icon: '\u{1F504}' },
  follow_up: { label: 'Дожим', icon: '\u{1F4CB}' },
}

const priorityConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'outline' }> = {
  high: { label: 'Высокий', variant: 'destructive' },
  medium: { label: 'Средний', variant: 'warning' },
  low: { label: 'Низкий', variant: 'outline' },
}

function getToday(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function TasksPage() {
  const [data, setData] = useState<TasksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(getToday())
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    callback: true,
    confirm_booking: true,
    reschedule: true,
    follow_up: true,
  })
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const fetchTasks = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?date=${d}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка загрузки' }))
        throw new Error(err.error || 'Ошибка загрузки')
      }
      const json = await res.json()
      setData(json)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки задач'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks(date)
  }, [date, fetchTasks])

  const updateTask = async (taskId: string, status: string) => {
    setUpdatingTask(taskId)
    try {
      const comment = commentInputs[taskId] || undefined
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status, comment }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка обновления' }))
        throw new Error(err.error || 'Ошибка обновления')
      }

      toast.success(
        status === 'done'
          ? 'Задача выполнена'
          : status === 'postponed'
          ? 'Задача перенесена'
          : 'Задача отмечена как неактуальная'
      )

      setCommentInputs((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })

      fetchTasks(date)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления задачи'
      toast.error(message)
    } finally {
      setUpdatingTask(null)
    }
  }

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const progressColor = (pct: number): 'green' | 'yellow' | 'red' => {
    if (pct >= 80) return 'green'
    if (pct >= 50) return 'yellow'
    return 'red'
  }

  const groupedTasks: Record<string, Task[]> = {}
  if (data) {
    for (const task of data.tasks) {
      if (!groupedTasks[task.type]) groupedTasks[task.type] = []
      groupedTasks[task.type].push(task)
    }
  }

  // Empty state
  if (!loading && data && data.summary.total === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">План дня</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-6xl mb-4">{'\u{1F4CB}'}</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Нет задач на сегодня</h2>
          <p className="text-gray-500 mb-6">Загрузите данные, чтобы система сгенерировала задачи</p>
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
        <h1 className="text-2xl font-bold text-gray-900">План дня</h1>

        {/* Date selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="task-date" className="text-sm text-gray-600">
            Дата:
          </label>
          <input
            id="task-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-8 w-full rounded-lg" />
          <div className="skeleton h-32 w-full rounded-xl" />
          <div className="skeleton h-32 w-full rounded-xl" />
          <div className="skeleton h-32 w-full rounded-xl" />
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <>
          {/* Progress bar */}
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  Прогресс: {data.summary.completed} / {data.summary.total} задач
                </span>
                <span
                  className={`text-sm font-bold ${
                    data.summary.progressPct >= 80
                      ? 'text-green-600'
                      : data.summary.progressPct >= 50
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {data.summary.progressPct}%
                </span>
              </div>
              <Progress value={data.summary.progressPct} color={progressColor(data.summary.progressPct)} />
            </CardContent>
          </Card>

          {/* Task groups */}
          <div className="space-y-4">
            {Object.entries(typeConfig).map(([type, config]) => {
              const tasks = groupedTasks[type] || []
              if (tasks.length === 0) return null
              const doneTasks = tasks.filter((t) => t.status === 'done').length
              const isExpanded = expandedGroups[type]

              return (
                <Card key={type}>
                  <CardHeader
                    className="cursor-pointer select-none hover:bg-gray-50 transition-colors rounded-t-xl"
                    onClick={() => toggleGroup(type)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-xl">{config.icon}</span>
                        <span>{config.label}</span>
                        <Badge variant={doneTasks === tasks.length ? 'success' : 'outline'}>
                          {doneTasks}/{tasks.length}
                        </Badge>
                      </CardTitle>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent>
                      <div className="space-y-3">
                        {tasks.map((task) => {
                          const prioCfg = priorityConfig[task.priority] || priorityConfig.low
                          const isDone = task.status === 'done'
                          const isPostponed = task.status === 'postponed'
                          const isIrrelevant = task.status === 'irrelevant'
                          const isCompleted = isDone || isPostponed || isIrrelevant
                          const isUpdating = updatingTask === task.id

                          return (
                            <div
                              key={task.id}
                              className={`p-4 rounded-lg border transition-colors ${
                                isDone
                                  ? 'bg-green-50 border-green-200'
                                  : isPostponed
                                  ? 'bg-yellow-50 border-yellow-200'
                                  : isIrrelevant
                                  ? 'bg-gray-50 border-gray-200'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p
                                      className={`text-sm font-medium ${
                                        isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                                      }`}
                                    >
                                      {task.description}
                                    </p>
                                    <Badge variant={prioCfg.variant}>{prioCfg.label}</Badge>
                                  </div>
                                  {task.assignedOp && (
                                    <p className="text-xs text-gray-500">
                                      Оператор: {task.assignedOp.name}
                                    </p>
                                  )}
                                  {isDone && task.completedAt && (
                                    <p className="text-xs text-green-600 mt-1">
                                      Выполнена {new Date(task.completedAt).toLocaleString('ru-RU')}
                                    </p>
                                  )}
                                  {isPostponed && (
                                    <p className="text-xs text-yellow-600 mt-1">Перенесено</p>
                                  )}
                                  {isIrrelevant && (
                                    <p className="text-xs text-gray-500 mt-1">Неактуально</p>
                                  )}
                                  {task.comment && (
                                    <p className="text-xs text-gray-500 mt-1 italic">
                                      Комментарий: {task.comment}
                                    </p>
                                  )}
                                </div>

                                {/* Action buttons */}
                                {!isCompleted && (
                                  <div className="flex flex-col gap-2 shrink-0">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => updateTask(task.id, 'done')}
                                        disabled={isUpdating}
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                      >
                                        {isUpdating ? '...' : 'Выполнено'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateTask(task.id, 'postponed')}
                                        disabled={isUpdating}
                                        className="text-yellow-700 border-yellow-300 hover:bg-yellow-50 text-xs"
                                      >
                                        Перенесено
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateTask(task.id, 'irrelevant')}
                                        disabled={isUpdating}
                                        className="text-gray-500 text-xs"
                                      >
                                        Неактуально
                                      </Button>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Комментарий..."
                                      value={commentInputs[task.id] || ''}
                                      onChange={(e) =>
                                        setCommentInputs((prev) => ({
                                          ...prev,
                                          [task.id]: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
