import type { OrderStatus, PaymentMethod } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

interface CreateOrderInput {
  userId: string
  eventId: string
  amountInCents: number
  currency: string
  stripePaymentIntentId: string
  idempotencyKey: string
  expiresAt: Date
  paymentMethod: PaymentMethod
}

export class OrdersRepository {
  create(db: Db, data: CreateOrderInput) {
    return db.order.create({ data })
  }

  // `holds` incluído para o front (etapa 08, "tentar outro cartão reaproveita os
  // mesmos assentos") -- sem isto, recriar um pedido depois de uma recusa exigiria
  // carregar `eventId`/`holdIds` por navegação (frágil a um F5); com `holds` na
  // própria resposta, o front deriva tudo a partir do pedido já carregado.
  findById(db: Db, id: string) {
    return db.order.findUnique({ where: { id }, include: { tickets: true, holds: true } })
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
