import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, getUserClinic } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    if (session.role !== 'owner') return NextResponse.json({ error: 'Только владелец' }, { status: 403 })

    const clinic = await getUserClinic(session)
    if (!clinic) return NextResponse.json({ error: 'Клиника не найдена' }, { status: 404 })

    const { confirmationName } = await req.json()
    if (confirmationName !== clinic.name) {
      return NextResponse.json({ error: 'Название клиники не совпадает' }, { status: 400 })
    }

    // Delete all data
    await prisma.task.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.anomaly.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.dailyLoss.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.dailyFunnel.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.callRecord.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.import.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.notification.deleteMany({ where: { clinicId: clinic.id } })
    await prisma.report.deleteMany({ where: { clinicId: clinic.id } })

    await prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: session.id,
        action: 'delete_all_data',
        details: { clinicName: clinic.name },
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
