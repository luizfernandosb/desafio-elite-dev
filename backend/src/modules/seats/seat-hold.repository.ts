import type { Db } from '../../shared/db'

interface HoldInput {
  id: string
  eventId: string
  seatId: string
  userId: string
  expiresAt: Date
}

export class SeatHoldRepository {
  // um único INSERT multi-linha -- se qualquer seatId colidir com o índice parcial
  // (seat_hold_active), a instrução inteira falha e nenhum hold é criado (§ etapa 06,
  // "reserva múltipla é atômica"). Não precisa de lógica extra para isso.
  createMany(db: Db, holds: HoldInput[]) {
    return db.seatHold.createMany({ data: holds })
  }

  countActiveForUser(db: Db, eventId: string, userId: string) {
    return db.seatHold.count({
      where: { eventId, userId, releasedAt: null, expiresAt: { gt: new Date() } },
    })
  }

  // liberação preguiçosa (§4.4.3) -- só dos assentos pedidos, não uma varredura geral
  // (isso é o pg_cron da etapa 11). Existe para não deixar um assento falsamente
  // ocupado por até 60s só porque a linha antiga ainda não foi varrida.
  async releaseExpiredAmong(db: Db, seatIds: string[]): Promise<number> {
    const result = await db.seatHold.updateMany({
      where: { seatId: { in: seatIds }, releasedAt: null, expiresAt: { lte: new Date() } },
      data: { releasedAt: new Date() },
    })
    return result.count
  }

  async findActiveSeatIds(db: Db, seatIds: string[]): Promise<string[]> {
    const rows = await db.seatHold.findMany({
      where: { seatId: { in: seatIds }, releasedAt: null, expiresAt: { gt: new Date() } },
      select: { seatId: true },
    })
    return rows.map((row) => row.seatId)
  }

  findOwnedById(db: Db, id: string, eventId: string, userId: string) {
    return db.seatHold.findFirst({ where: { id, eventId, userId } })
  }

  release(db: Db, id: string) {
    return db.seatHold.update({ where: { id }, data: { releasedAt: new Date() } })
  }

  findActiveByUser(db: Db, eventId: string, userId: string) {
    return db.seatHold.findMany({
      where: { eventId, userId, releasedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    })
  }

  // usado na criação do pedido (etapa 07) -- ativos, do próprio usuário, do mesmo
  // evento. Qualquer hold fora desse conjunto faz o pedido inteiro falhar.
  findManyOwnedActive(db: Db, holdIds: string[], eventId: string, userId: string) {
    return db.seatHold.findMany({
      where: { id: { in: holdIds }, eventId, userId, releasedAt: null, expiresAt: { gt: new Date() } },
    })
  }

  linkToOrder(db: Db, holdIds: string[], orderId: string) {
    return db.seatHold.updateMany({ where: { id: { in: holdIds } }, data: { orderId } })
  }

  findByOrderId(db: Db, orderId: string) {
    return db.seatHold.findMany({ where: { orderId } })
  }

  // o hold foi *consumido* pela compra -- releasedAt preenchido, mas por um motivo
  // diferente de "expirou" ou "o cliente desistiu" (§4.6.2, invariante do Ticket)
  consume(db: Db, holdIds: string[]) {
    return db.seatHold.updateMany({ where: { id: { in: holdIds } }, data: { releasedAt: new Date() } })
  }
}
