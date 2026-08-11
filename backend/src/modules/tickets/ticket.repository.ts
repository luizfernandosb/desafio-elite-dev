import type { Db } from '../../shared/db'

interface CreateTicketInput {
  id: string
  orderId: string
  eventId: string
  seatId: string
  codeHash: string
  qrJti: string
}

export class TicketRepository {
  create(db: Db, data: CreateTicketInput) {
    return db.ticket.create({ data })
  }

  findByOrderId(db: Db, orderId: string) {
    return db.ticket.findMany({ where: { orderId } })
  }
}
