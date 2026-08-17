import type { PrismaClient } from '../../generated/prisma/client'
import { env } from '../../src/config/env'
import { deriveTicketCode } from '../../src/modules/tickets/qr.service'

export interface DemoSummary {
  activeCode: string | null
  activeSeat: string | null
  usedCode: string | null
  shareUrl: string | null
}

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
