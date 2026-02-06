import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, createToken } from '@/lib/auth'
import { DEFAULT_BENCHMARKS } from '@/lib/formulas'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const body = await req.json()
    const { clinicName, clinicType, chairsCount, avgCheck, timezone } = body

    const clinic = await prisma.clinic.create({
      data: {
        organizationId: session.organizationId,
        name: clinicName || 'Моя клиника',
        type: clinicType || 'dental',
        chairsCount: chairsCount || 3,
        avgCheck: avgCheck || 5000,
        timezone: timezone || 'Europe/Moscow',
      },
    })

    await prisma.clinicBenchmark.create({
      data: {
        clinicId: clinic.id,
        ...DEFAULT_BENCHMARKS,
      },
    })

    await prisma.notificationSetting.create({
      data: {
        clinicId: clinic.id,
        emailRecipients: [session.email],
      },
    })

    await prisma.user.update({
      where: { id: session.id },
      data: { clinicId: clinic.id },
    })

    // Refresh token with clinicId
    const token = await createToken({
      ...session,
      clinicId: clinic.id,
    })

    const res = NextResponse.json({ clinicId: clinic.id })
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return res
  } catch (e: unknown) {
    console.error('Onboarding error:', e)
    return NextResponse.json({ error: 'Ошибка создания клиники' }, { status: 500 })
  }
}
