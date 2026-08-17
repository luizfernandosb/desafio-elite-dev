import { Role } from '../../generated/prisma/enums'
import type { PrismaClient } from '../../generated/prisma/client'
import { hashPassword } from '../../src/modules/auth/password.service'

export const SEED_PASSWORD = 'Ticket@2026'

export interface SeededUsers {
  organizer: { id: string; email: string }
  customer1: { id: string; email: string }
  customer2: { id: string; email: string }
  gate: { id: string; email: string }
}

async function upsertUser(
  prisma: PrismaClient,
  input: { email: string; name: string; role: Role; passwordHash: string },
) {
  return prisma.user.upsert({
    where: { email: input.email },
    create: { email: input.email, name: input.name, role: input.role, passwordHash: input.passwordHash },
    update: { name: input.name, role: input.role },
  })
}

export async function seedUsers(prisma: PrismaClient): Promise<SeededUsers> {
  const passwordHash = await hashPassword(SEED_PASSWORD)

  const [organizer, customer1, customer2, gate] = await Promise.all([
    upsertUser(prisma, { email: 'organizador@ticketdev.test', name: 'Ana Organizadora', role: Role.ORGANIZER, passwordHash }),
    upsertUser(prisma, { email: 'cliente1@ticketdev.test', name: 'Bruno Cliente', role: Role.CUSTOMER, passwordHash }),
    upsertUser(prisma, { email: 'cliente2@ticketdev.test', name: 'Carla Cliente', role: Role.CUSTOMER, passwordHash }),
    upsertUser(prisma, { email: 'portaria@ticketdev.test', name: 'Diego Portaria', role: Role.GATE, passwordHash }),
  ])

  return { organizer, customer1, customer2, gate }
}
