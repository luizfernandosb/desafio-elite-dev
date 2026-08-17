import type { PrismaClient } from '../../generated/prisma/client'
import { seedEvents, type SeededEvents } from './events.seed'
import { seedSalesForEventA } from './sales.seed'
import { seedUsers, type SeededUsers } from './users.seed'

export interface SeedResult {
  users: SeededUsers
  events: SeededEvents
}

export async function runSeed(prisma: PrismaClient): Promise<SeedResult> {
  const users = await seedUsers(prisma)
  const events = await seedEvents(prisma, users.organizer.id)

  if (events.eventA.created) {
    await seedSalesForEventA(prisma, {
      eventId: events.eventA.id,
      priceInCents: events.eventA.priceInCents,
      startsAt: events.eventA.startsAt,
      endsAt: events.eventA.endsAt,
      seats: events.eventA.seats,
      customer1Id: users.customer1.id,
      customer2Id: users.customer2.id,
      gateUserId: users.gate.id,
    })
  }

  return { users, events }
}
