import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const lessons = await prisma.lesson.findMany({
      where: { isActive: true },
      include: {
        category: true,
        progress: { where: { userId: session.id } },
      },
      orderBy: [{ sortOrder: 'asc' }],
    })

    const result = lessons.map(l => ({
      id: l.id,
      title: l.title,
      category: l.category?.name || 'Общее',
      situation: l.situation,
      correctScript: l.correctScript,
      incorrectScript: l.incorrectScript,
      incorrectExplanation: l.incorrectExplanation,
      quizQuestion: l.quizQuestion,
      quizOptions: l.quizOptions,
      quizCorrectIndex: l.quizCorrectIndex,
      completed: l.progress.length > 0,
      quizCorrect: l.progress[0]?.quizCorrect ?? null,
    }))

    const total = result.length
    const completed = result.filter(l => l.completed).length

    // Daily lesson: first uncompleted
    const daily = result.find(l => !l.completed) || result[0] || null

    return NextResponse.json({ lessons: result, total, completed, daily })
  } catch (e: unknown) {
    console.error('Lessons error:', e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const { lessonId, quizAnswer } = await req.json()

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })
    if (!lesson) return NextResponse.json({ error: 'Урок не найден' }, { status: 404 })

    const quizCorrect = quizAnswer === lesson.quizCorrectIndex

    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: session.id, lessonId } },
      create: { userId: session.id, lessonId, quizAnswer, quizCorrect },
      update: { quizAnswer, quizCorrect, completedAt: new Date() },
    })

    return NextResponse.json({ correct: quizCorrect, correctIndex: lesson.quizCorrectIndex })
  } catch (e: unknown) {
    console.error('Complete lesson error:', e)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
