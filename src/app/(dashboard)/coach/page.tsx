'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Lesson {
  id: string
  title: string
  category: string
  situation: string
  correctScript: string
  incorrectScript: string
  incorrectExplanation: string
  quizQuestion: string
  quizOptions: string[]
  quizCorrectIndex: number
  completed: boolean
  quizCorrect: boolean | null
}

interface LessonsResponse {
  lessons: Lesson[]
  total: number
  completed: number
  daily: Lesson | null
}

interface Script {
  id: string
  title: string
  text: string
  type: 'recommended' | 'forbidden'
  complianceNote: string | null
}

interface ScriptCategory {
  id: string
  name: string
  scripts: Script[]
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function CoachPage() {
  const [activeTab, setActiveTab] = useState<'lesson' | 'scripts'>('lesson')

  /* ----- Lessons state ----- */
  const [lessonsData, setLessonsData] = useState<LessonsResponse | null>(null)
  const [lessonsLoading, setLessonsLoading] = useState(true)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizResult, setQuizResult] = useState<{ correct: boolean; correctIndex: number } | null>(null)
  const [quizSubmitting, setQuizSubmitting] = useState(false)

  /* ----- Scripts state ----- */
  const [categories, setCategories] = useState<ScriptCategory[]>([])
  const [scriptsLoading, setScriptsLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  /* ----- Load data on mount ----- */
  useEffect(() => {
    async function loadLessons() {
      try {
        const res = await fetch('/api/coach/lessons')
        if (!res.ok) throw new Error('Failed to load lessons')
        const data = await res.json()
        setLessonsData(data)

        // If daily lesson is already completed, mark quiz as submitted
        if (data.daily?.completed) {
          setQuizSubmitted(true)
          setQuizResult({
            correct: data.daily.quizCorrect ?? false,
            correctIndex: data.daily.quizCorrectIndex,
          })
        }
      } catch {
        toast.error('Не удалось загрузить уроки')
      } finally {
        setLessonsLoading(false)
      }
    }

    async function loadScripts() {
      try {
        const res = await fetch('/api/coach/scripts')
        if (!res.ok) throw new Error('Failed to load scripts')
        const data = await res.json()
        setCategories(data.categories || [])
      } catch {
        toast.error('Не удалось загрузить скрипты')
      } finally {
        setScriptsLoading(false)
      }
    }

    loadLessons()
    loadScripts()
  }, [])

  /* ----- Quiz submit ----- */
  async function handleQuizSubmit() {
    if (selectedAnswer === null || !lessonsData?.daily) return
    setQuizSubmitting(true)

    try {
      const res = await fetch('/api/coach/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lessonsData.daily.id,
          quizAnswer: selectedAnswer,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Ошибка отправки ответа')
        return
      }

      setQuizResult({ correct: data.correct, correctIndex: data.correctIndex })
      setQuizSubmitted(true)

      if (data.correct) {
        toast.success('Правильно!')
      } else {
        toast.error('Неправильно. Посмотрите правильный ответ.')
      }

      // Update local completed count
      setLessonsData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          completed: prev.completed + (data.correct ? 1 : 0),
          daily: prev.daily ? { ...prev.daily, completed: true, quizCorrect: data.correct } : null,
        }
      })
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setQuizSubmitting(false)
    }
  }

  /* ----- Toggle category expansion ----- */
  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const daily = lessonsData?.daily
  const progressPct = lessonsData
    ? lessonsData.total > 0
      ? Math.round((lessonsData.completed / lessonsData.total) * 100)
      : 0
    : 0

  /* ----- Render ----- */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Коуч</h1>
        <p className="mt-1 text-sm text-gray-500">
          Обучение администраторов: ежедневные уроки и скрипты разговоров
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('lesson')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'lesson'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Урок дня
        </button>
        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'scripts'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Скрипты
        </button>
      </div>

      {/* ============================================================ */}
      {/*  Tab 1: Урок дня                                              */}
      {/* ============================================================ */}
      {activeTab === 'lesson' && (
        <div className="space-y-6">
          {/* Progress bar */}
          {lessonsData && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    Прогресс обучения
                  </span>
                  <span className="text-gray-500">
                    {lessonsData.completed} / {lessonsData.total} уроков
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={progressPct} color="blue" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {lessonsLoading && (
            <Card>
              <CardContent className="flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563eb]" />
                  <p className="mt-3 text-sm text-gray-500">Загрузка урока...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No lessons */}
          {!lessonsLoading && !daily && (
            <Card>
              <CardContent className="flex items-center justify-center p-12">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-3 text-lg font-medium text-gray-900">Все уроки пройдены!</p>
                  <p className="mt-1 text-sm text-gray-500">Возвращайтесь завтра за новым уроком.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily lesson */}
          {!lessonsLoading && daily && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{daily.title}</CardTitle>
                  <Badge variant="default">{daily.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Situation */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Ситуация:
                  </h4>
                  <p className="rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                    {daily.situation}
                  </p>
                </div>

                {/* Correct script */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-600">
                    Правильно:
                  </h4>
                  <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
                    <p className="text-sm leading-relaxed text-green-800 whitespace-pre-line">
                      {daily.correctScript}
                    </p>
                  </div>
                </div>

                {/* Incorrect script */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">
                    Неправильно:
                  </h4>
                  <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
                    <p className="text-sm leading-relaxed text-red-800 whitespace-pre-line">
                      {daily.incorrectScript}
                    </p>
                  </div>
                </div>

                {/* Explanation */}
                {daily.incorrectExplanation && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Почему это неправильно:
                    </h4>
                    <p className="rounded-lg bg-yellow-50 p-4 text-sm leading-relaxed text-yellow-800">
                      {daily.incorrectExplanation}
                    </p>
                  </div>
                )}

                {/* Quiz */}
                {daily.quizQuestion && daily.quizOptions && daily.quizOptions.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-4 text-base font-semibold text-gray-900">
                      {daily.quizQuestion}
                    </h4>
                    <div className="space-y-3">
                      {daily.quizOptions.map((option: string, idx: number) => {
                        let optionStyle = 'border-gray-200 bg-white hover:bg-gray-50'
                        if (quizSubmitted && quizResult) {
                          if (idx === quizResult.correctIndex) {
                            optionStyle = 'border-green-500 bg-green-50'
                          } else if (idx === selectedAnswer && !quizResult.correct) {
                            optionStyle = 'border-red-500 bg-red-50'
                          } else {
                            optionStyle = 'border-gray-200 bg-gray-50 opacity-60'
                          }
                        } else if (idx === selectedAnswer) {
                          optionStyle = 'border-[#2563eb] bg-blue-50'
                        }

                        return (
                          <label
                            key={idx}
                            className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${optionStyle} ${
                              quizSubmitted ? 'cursor-default' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="quiz"
                              value={idx}
                              checked={selectedAnswer === idx}
                              onChange={() => !quizSubmitted && setSelectedAnswer(idx)}
                              disabled={quizSubmitted}
                              className="mr-3 h-4 w-4 text-[#2563eb] focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        )
                      })}
                    </div>

                    {/* Quiz result message */}
                    {quizSubmitted && quizResult && (
                      <div
                        className={`mt-4 rounded-lg p-3 text-sm font-medium ${
                          quizResult.correct
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {quizResult.correct
                          ? 'Правильно! Отличная работа.'
                          : `Неправильно. Правильный ответ: "${daily.quizOptions[quizResult.correctIndex]}"`}
                      </div>
                    )}

                    {/* Submit button */}
                    {!quizSubmitted && (
                      <Button
                        onClick={handleQuizSubmit}
                        disabled={selectedAnswer === null || quizSubmitting}
                        className="mt-4"
                      >
                        {quizSubmitting ? 'Проверка...' : 'Ответить'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Tab 2: Скрипты                                               */}
      {/* ============================================================ */}
      {activeTab === 'scripts' && (
        <div className="space-y-4">
          {/* Loading */}
          {scriptsLoading && (
            <Card>
              <CardContent className="flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563eb]" />
                  <p className="mt-3 text-sm text-gray-500">Загрузка скриптов...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!scriptsLoading && categories.length === 0 && (
            <Card>
              <CardContent className="flex items-center justify-center p-12">
                <p className="text-sm text-gray-500">Скрипты ещё не добавлены.</p>
              </CardContent>
            </Card>
          )}

          {/* Categories */}
          {!scriptsLoading &&
            categories.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id)
              return (
                <Card key={cat.id}>
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex w-full items-center justify-between p-6 text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">{cat.name}</h3>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        {cat.scripts.length}
                      </span>
                    </div>
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <CardContent className="border-t border-gray-100 pt-4">
                      <div className="space-y-4">
                        {cat.scripts.map((script) => (
                          <div
                            key={script.id}
                            className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="font-medium text-gray-900">{script.title}</h4>
                              <Badge
                                variant={script.type === 'recommended' ? 'success' : 'destructive'}
                              >
                                {script.type === 'recommended' ? 'Рекомендуется' : 'Запрещено'}
                              </Badge>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                              {script.text}
                            </p>
                            {script.complianceNote && (
                              <p className="mt-2 rounded border-l-2 border-yellow-400 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                                {script.complianceNote}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
        </div>
      )}
    </div>
  )
}
