import { TicketStatus } from '../../../generated/prisma/enums'
import type { ValidationResult } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

const GATE_TICKET_INCLUDE = {
  event: { select: { id: true, title: true, startsAt: true, endsAt: true } },
  seat: { select: { row: true, number: true } },
  validatedBy: { select: { name: true } },
} as const

interface CreateLogInput {
  eventId: string
  ticketId: string | null
  gateUserId: string
  result: ValidationResult
  codePrefix: string
}

export class GateRepository {
  findByCodeHash(db: Db, codeHash: string) {
    return db.ticket.findUnique({ where: { codeHash }, include: GATE_TICKET_INCLUDE })
  }

  async markUsed(db: Db, ticketId: string, gateUserId: string): Promise<boolean> {
    const result = await db.ticket.updateMany({
      where: { id: ticketId, usedAt: null },
      data: { usedAt: new Date(), validatedById: gateUserId, status: TicketStatus.USED },
    })
    return result.count === 1
  }

  createLog(db: Db, data: CreateLogInput) {
    return db.validationLog.create({ data })
  }

  countTotal(db: Db, eventId: string) {
    return db.ticket.count({ where: { eventId } })
  }

  countUsed(db: Db, eventId: string) {
    return db.ticket.count({ where: { eventId, status: TicketStatus.USED } })
  }

  lastValidations(db: Db, eventId: string, limit: number) {
    return db.validationLog.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
