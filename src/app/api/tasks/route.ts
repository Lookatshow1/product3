import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const url = new URL(req.url)
    const dateStr = url.searchParams.get('date')
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')

    const where: Record<string, unknown> = { clinicId: clinic.id }

    if (dateStr) {
      const d = new Date(dateStr)
      d.setUTCHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.date = { gte: d, lt: next }
    }
    if (status) where.status = status
    if (type) where.type = type

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: { assignedOp: true },
    })

    // Summary
    const total = tasks.length
    const completed = tasks.filter(t => t.status === 'done').length
    const byType: Record<string, { count: number; completed: number }> = {}

    for (const t of tasks) {
      if (!byType[t.type]) byType[t.type] = { count: 0, completed: 0 }
      byType[t.type].count++
      if (t.status === 'done') byType[t.type].completed++
    }

    return NextResponse.json({
      tasks,
      summary: { total, completed, progressPct: total > 0 ? Math.round((completed / total) * 100) : 0, byType },
    })
  } catch (e: unknown) {
    console.error('Tasks error:', e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const body = await req.json()
    const { id, status, result, comment, postponedTo } = body

    if (!id) return NextResponse.json({ error: 'ID задачи обязателен' }, { status: 400 })

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: status || undefined,
        result: result || undefined,
        comment: comment || undefined,
        postponedTo: postponedTo ? new Date(postponedTo) : undefined,
        completedById: status === 'done' ? session.id : undefined,
        completedAt: status === 'done' ? new Date() : undefined,
      },
    })

    return NextResponse.json({ task })
  } catch (e: unknown) {
    console.error('Task update error:', e)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
