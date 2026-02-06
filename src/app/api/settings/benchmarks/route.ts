import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'
import { DEFAULT_BENCHMARKS } from '@/lib/formulas'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const bench = await prisma.clinicBenchmark.findUnique({ where: { clinicId: clinic.id } })
    return NextResponse.json({ benchmarks: bench || DEFAULT_BENCHMARKS })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const body = await req.json()
    const bench = await prisma.clinicBenchmark.upsert({
      where: { clinicId: clinic.id },
      create: { clinicId: clinic.id, ...body },
      update: body,
    })

    return NextResponse.json({ benchmarks: bench })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
