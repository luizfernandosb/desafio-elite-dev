import { randomBytes, randomUUID } from 'node:crypto'
import type { PrismaClient } from '../../generated/prisma/client'
import { OrderStatus, SeatStatus, TicketStatus, ValidationResult } from '../../generated/prisma/enums'
import type { GeneratedSeat } from '../../src/modules/events/seatmap.service'
import { generateTicketCode } from '../../src/modules/tickets/qr.service'
import { computeShareExpiresAt } from '../../src/shared/date'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const HOLD_TTL_MS = 8 * MINUTE_MS
const SHARE_TOKEN_BYTES = 32 // mesmo tamanho de ticket.service.ts (etapa 09)

function seatAt(seats: GeneratedSeat[], row: string, number: number): GeneratedSeat {
  const seat = seats.find((s) => s.row === row && s.number === number)
  if (!seat) throw new Error(`seed: assento ${row}${number} não existe no layout gerado`)
  return seat
}

async function createTicket(prisma: PrismaClient, input: { orderId: string; eventId: string; seatId: string }) {
  const ticketId = randomUUID()
  // gera o QR pelo mesmo serviço real da compra de verdade (etapa 08) -- se o seed
  // montasse codeHash à mão, o código não passaria na portaria (§ riscos da etapa 13)
  const { code, codeHash, jti } = generateTicketCode({ ticketId, eventId: input.eventId })
  const ticket = await prisma.ticket.create({
    data: { id: ticketId, orderId: input.orderId, eventId: input.eventId, seatId: input.seatId, codeHash, qrJti: jti },
  })
  return { ...ticket, code }
}

export async function seedSalesForEventA(
  prisma: PrismaClient,
  input: {
    eventId: string
    priceInCents: number
    startsAt: Date
    endsAt: Date | null
    seats: GeneratedSeat[]
    customer1Id: string
    customer2Id: string
    gateUserId: string
  },
): Promise<void> {
  const { eventId, seats, customer1Id, customer2Id, gateUserId } = input
  const now = Date.now()

  // ---- "sala cheia" (~15 assentos vendidos, bloco central, §objetivo) ----
  // D4-D6 têm Order + Ticket reais (criados abaixo); D7-D11 e E4-E10 são só
  // seat_state SOLD -- decoração para o mapa não parecer vazio, sem pedido nem
  // ingresso por trás. Deliberado: o critério de aceite da etapa fixa 4 usuários no
  // banco, e não caberia um comprador de verdade em cada um dos ~15 assentos.
  const decorativeSoldSeats = [
    seatAt(seats, 'D', 7),
    seatAt(seats, 'D', 8),
    seatAt(seats, 'D', 9),
    seatAt(seats, 'D', 10),
    seatAt(seats, 'D', 11),
    seatAt(seats, 'E', 4),
    seatAt(seats, 'E', 5),
    seatAt(seats, 'E', 6),
    seatAt(seats, 'E', 7),
    seatAt(seats, 'E', 8),
    seatAt(seats, 'E', 9),
    seatAt(seats, 'E', 10),
  ]
  await prisma.seatState.updateMany({
    where: { seatId: { in: decorativeSoldSeats.map((seat) => seat.id) } },
    data: { status: SeatStatus.SOLD },
  })

  // ---- Cliente 1: Order PAID, 2 ingressos ACTIVE (D4, D5) ----
  const seatD4 = seatAt(seats, 'D', 4)
  const seatD5 = seatAt(seats, 'D', 5)

  const order1 = await prisma.order.create({
    data: {
      userId: customer1Id,
      eventId,
      status: OrderStatus.PAID,
      amountInCents: input.priceInCents * 2,
      expiresAt: new Date(now + 30 * MINUTE_MS),
    },
  })
  const ticket1 = await createTicket(prisma, { orderId: order1.id, eventId, seatId: seatD4.id })
  await createTicket(prisma, { orderId: order1.id, eventId, seatId: seatD5.id })
  await prisma.seatState.updateMany({
    where: { seatId: { in: [seatD4.id, seatD5.id] } },
    data: { status: SeatStatus.SOLD },
  })

  // shareToken já gerado num dos dois -- demonstra a etapa 09 sem precisar criar um.
  // Mesmo cálculo de TicketService.createShareLink, sem passar pela camada HTTP.
  const shareToken = randomBytes(SHARE_TOKEN_BYTES).toString('base64url')
  const shareExpiresAt = computeShareExpiresAt({ startsAt: input.startsAt, endsAt: input.endsAt })
  await prisma.ticket.update({ where: { id: ticket1.id }, data: { shareToken, shareExpiresAt } })

  // ---- Cliente 2: Order PAID, 1 ingresso USED (D6) -- "já utilizado" a um scan de
  // distância. O QR é real (mesmo generateTicketCode da compra de verdade); só o
  // "quando foi escaneado" é encenado direto no banco -- gateService.validate() só
  // sabe gravar `usedAt = agora`, e o cenário pede 1h atrás.
  const seatD6 = seatAt(seats, 'D', 6)
  const order2 = await prisma.order.create({
    data: {
      userId: customer2Id,
      eventId,
      status: OrderStatus.PAID,
      amountInCents: input.priceInCents,
      expiresAt: new Date(now + 30 * MINUTE_MS),
    },
  })
  const usedTicket = await createTicket(prisma, { orderId: order2.id, eventId, seatId: seatD6.id })
  const usedAt = new Date(now - HOUR_MS)
  await prisma.ticket.update({
    where: { id: usedTicket.id },
    data: { status: TicketStatus.USED, usedAt, validatedById: gateUserId },
  })
  await prisma.seatState.updateMany({ where: { seatId: seatD6.id }, data: { status: SeatStatus.SOLD } })
  await prisma.validationLog.create({
    data: {
      eventId,
      ticketId: usedTicket.id,
      gateUserId,
      result: ValidationResult.VALID,
      codePrefix: usedTicket.code.slice(0, 8),
      createdAt: usedAt,
    },
  })

  // ---- Cliente 1 também com um hold ativo (F4-F6) -- HELD de verdade, expirável
  // pelo pg_cron (etapa 11), diferente dos SOLD decorativos acima: aqui existe
  // SeatHold real por trás, então a expiração natural (ou manual, via UPDATE do job)
  // continua funcionando igual à de qualquer reserva de cliente de verdade.
  const heldSeats = [seatAt(seats, 'F', 4), seatAt(seats, 'F', 5), seatAt(seats, 'F', 6)]
  const holdExpiresAt = new Date(now + HOLD_TTL_MS)
  await prisma.seatHold.createMany({
    data: heldSeats.map((seat) => ({ eventId, seatId: seat.id, userId: customer1Id, expiresAt: holdExpiresAt })),
  })
  await prisma.seatState.updateMany({
    where: { seatId: { in: heldSeats.map((seat) => seat.id) } },
    data: { status: SeatStatus.HELD, expiresAt: holdExpiresAt },
  })
}
