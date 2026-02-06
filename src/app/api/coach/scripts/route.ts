import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const clinic = await getUserClinic(session)

    const categories = await prisma.scriptCategory.findMany({
      where: { OR: [{ clinicId: null }, { clinicId: clinic?.id }] },
      include: {
        scripts: {
          where: { OR: [{ clinicId: null }, { clinicId: clinic?.id }] },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ categories })
  } catch (e: unknown) {
    console.error('Scripts error:', e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
