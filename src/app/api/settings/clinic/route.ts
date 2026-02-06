import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    return NextResponse.json({ clinic })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    if (session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const body = await req.json()
    const updated = await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        name: body.name ?? clinic.name,
        type: body.type ?? clinic.type,
        chairsCount: body.chairsCount ?? clinic.chairsCount,
        avgCheck: body.avgCheck ?? clinic.avgCheck,
        timezone: body.timezone ?? clinic.timezone,
        workStart: body.workStart ?? clinic.workStart,
        workEnd: body.workEnd ?? clinic.workEnd,
        privacyMode: body.privacyMode ?? clinic.privacyMode,
      },
    })

    return NextResponse.json({ clinic: updated })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
