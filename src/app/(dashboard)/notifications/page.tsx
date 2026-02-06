'use client'

import { useState, useEffect } from 'react'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => setNotifications(d.notifications || []))
      .finally(() => setLoading(false))
  }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const typeIcons: Record<string, string> = {
    import_complete: '\u2705',
    anomaly: '\u{1F6A8}',
    task_deadline: '\u23F0',
    lesson_available: '\u{1F4DA}',
    report_ready: '\u{1F4C4}',
    digest: '\u{1F4E7}',
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Уведомления</h1>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800">
            Прочитать все
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Нет уведомлений
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-lg border ${n.read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-100'}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{typeIcons[n.type] || '\u{1F514}'}</span>
                <div className="flex-1">
                  <p className={`font-medium ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                  {n.body && <p className="text-sm text-gray-500 mt-1">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
