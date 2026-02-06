import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  organizationId: string
  clinicId: string | null
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getSessionOrThrow(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export async function getUserClinic(session: SessionUser) {
  if (session.clinicId) {
    return prisma.clinic.findUnique({ where: { id: session.clinicId } })
  }
  return prisma.clinic.findFirst({ where: { organizationId: session.organizationId } })
}

export async function getClinicWithBenchmarks(clinicId: string) {
  return prisma.clinic.findUnique({
    where: { id: clinicId },
    include: { benchmarks: true },
  })
}
