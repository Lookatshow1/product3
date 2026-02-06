import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const users = await prisma.user.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, clinicId: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    if (session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    const clinic = await getUserClinic(session)
    const { email, name, role, password } = await req.json()

    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Email, имя и роль обязательны' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Пользователь уже существует' }, { status: 409 })

    const passwordHash = await hash(password || 'change-me-123', 12)

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash,
        organizationId: session.organizationId,
        clinicId: clinic?.id,
      },
    })

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
