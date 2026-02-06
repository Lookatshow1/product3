import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, пароль и имя обязательны' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
    }

    const passwordHash = await hash(password, 12)

    const org = await prisma.organization.create({
      data: { name: `Организация ${name}` },
    })

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'owner',
        organizationId: org.id,
      },
    })

    const token = await createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      clinicId: user.clinicId,
    })

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      needsOnboarding: true,
    })

    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return res
  } catch (e: unknown) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 })
  }
}
