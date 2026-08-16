import { TicketStatus } from '../../../generated/prisma/enums'
import type { TicketPriceType } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

interface CreateTicketInput {
  id: string
  orderId: string
  eventId: string
  seatId: string
  priceType: TicketPriceType
  codeHash: string
  qrJti: string
}

const TICKET_INCLUDE = {
  event: {
    select: {
      id: true,
      title: true,
      imageUrl: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      venueName: true,
      venueCity: true,
      format: true,
      audio: true,
      roomType: true,
    },
  },
  seat: { select: { row: true, number: true } },
} as const

export class TicketRepository {
  create(db: Db, data: CreateTicketInput) {
    return db.ticket.create({ data })
  }

  findByOrderId(db: Db, orderId: string) {
    return db.ticket.findMany({ where: { orderId } })
  }

  updateStatus(db: Db, id: string, status: TicketStatus) {
    return db.ticket.update({ where: { id }, data: { status } })
  }

  // usado para decidir se a Order inteira já pode virar REFUNDED (§ cancelamento) --
  // só quando não sobra nenhum ticket ACTIVE naquele pedido.
  countActiveByOrderId(db: Db, orderId: string) {
    return db.ticket.count({ where: { orderId, status: TicketStatus.ACTIVE } })
  }

  // dono é sempre resolvido por order.userId -- Ticket não tem coluna própria de userId
  async findManyByUser(db: Db, userId: string, page: number, limit: number) {
    const where = { order: { userId } }
    const [data, total] = await Promise.all([
      db.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: TICKET_INCLUDE,
      }),
      db.ticket.count({ where }),
    ])
    return { data, total }
  }

  findOwnedById(db: Db, id: string, userId: string) {
    return db.ticket.findFirst({ where: { id, order: { userId } }, include: TICKET_INCLUDE })
  }

  setShareToken(db: Db, id: string, data: { shareToken: string; shareExpiresAt: Date }) {
    return db.ticket.update({
      where: { id },
      data: { shareToken: data.shareToken, shareExpiresAt: data.shareExpiresAt, shareRevokedAt: null },
    })
  }

  revokeShare(db: Db, id: string) {
    return db.ticket.update({ where: { id }, data: { shareRevokedAt: new Date() } })
  }

  // rota pública -- só o que a página de compartilhamento precisa (§7.7). Nunca
  // inclui order/userId: quem comprou não é dado desta rota.
  findByShareToken(db: Db, shareToken: string) {
    return db.ticket.findUnique({ where: { shareToken }, include: TICKET_INCLUDE })
  }
}
