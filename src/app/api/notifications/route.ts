import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Нет клиники' }, { status: 404 })

    const notifications = await prisma.notification.findMany({
      where: { clinicId: clinic.id, OR: [{ userId: session.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unread = notifications.filter(n => !n.read).length

    return NextResponse.json({ notifications, unread })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Нет клиники' }, { status: 404 })

    await prisma.notification.updateMany({
      where: { clinicId: clinic.id, userId: session.id, read: false },
      data: { read: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
