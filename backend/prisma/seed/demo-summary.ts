import type { PrismaClient } from '../../generated/prisma/client'
import { env } from '../../src/config/env'
import { deriveTicketCode } from '../../src/modules/tickets/qr.service'

export interface DemoSummary {
  activeCode: string | null
  activeSeat: string | null
  usedCode: string | null
  shareUrl: string | null
}

// Lê de volta o estado atual do Evento A e recalcula os códigos pelo serviço real
// (`deriveTicketCode`, etapa 08) -- nunca guarda o código em claro, então "qual é o
// código pronto pra escanear" sempre passa por aqui, tanto num seed novo quanto num
// rerun. Reaproveitado pelo teste de integração para provar que o QR semeado é válido.
export async function readDemoSummary(prisma: PrismaClient, eventId: string): Promise<DemoSummary> {
  const [active, used, shared] = await Promise.all([
    prisma.ticket.findFirst({
      where: { eventId, status: 'ACTIVE', seatId: { not: null } },
      include: { seat: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ticket.findFirst({ where: { eventId, status: 'USED' } }),
    prisma.ticket.findFirst({ where: { eventId, shareToken: { not: null } } }),
  ])

  return {
    activeCode: active ? deriveTicketCode({ ticketId: active.id, eventId, jti: active.qrJti }) : null,
    activeSeat: active?.seat ? `${active.seat.row}${active.seat.number}` : null,
    usedCode: used ? deriveTicketCode({ ticketId: used.id, eventId, jti: used.qrJti }) : null,
    shareUrl: shared?.shareToken ? `${env.APP_PUBLIC_URL}/share/${shared.shareToken}` : null,
  }
}
