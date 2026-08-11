import type { OrderStatus } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

interface CreateOrderInput {
  userId: string
  eventId: string
  amountInCents: number
  currency: string
  stripePaymentIntentId: string
  idempotencyKey: string
  expiresAt: Date
}

export class OrdersRepository {
  create(db: Db, data: CreateOrderInput) {
    return db.order.create({ data })
  }

  findById(db: Db, id: string) {
    return db.order.findUnique({ where: { id }, include: { tickets: true } })
  }

  findByIdempotencyKey(db: Db, idempotencyKey: string) {
    return db.order.findUnique({ where: { idempotencyKey } })
  }

  findByPaymentIntentId(db: Db, stripePaymentIntentId: string) {
    return db.order.findUnique({ where: { stripePaymentIntentId } })
  }

  updateStatus(db: Db, id: string, status: OrderStatus) {
    return db.order.update({ where: { id }, data: { status } })
  }
}
