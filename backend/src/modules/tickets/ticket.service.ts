import { randomBytes } from 'node:crypto'
import type { Logger } from 'pino'
import { EventAudio, EventFormat, RoomType, TicketStatus } from '../../../generated/prisma/enums'
import { env } from '../../config/env'
import { prisma } from '../../lib/prisma'
import { computeShareExpiresAt } from '../../shared/date'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors'
import { paginate, type PaginatedResponse, type PaginationQuery } from '../../shared/pagination'
import { deriveTicketCode } from './qr.service'
import type { TicketRepository } from './ticket.repository'

const SHARE_TOKEN_BYTES = 32

interface EventSummary {
  id: string
  title: string
  imageUrl: string | null
  startsAt: Date
  endsAt: Date | null
  timezone: string
  venueName: string
  venueCity: string
  format: EventFormat
  audio: EventAudio
  roomType: RoomType
}

interface TicketRecord {
  id: string
  status: TicketStatus
  usedAt: Date | null
  createdAt: Date
  eventId: string
  qrJti: string
  shareToken: string | null
  shareExpiresAt: Date | null
  shareRevokedAt: Date | null
  event: EventSummary
  seat: { row: string; number: number } | null
}

export interface PublicTicket {
  id: string
  status: TicketStatus
  usedAt: Date | null
  createdAt: Date
  event: EventSummary
  seat: TicketRecord['seat']
}

export interface ShareLink {
  url: string
  expiresAt: Date
}

// payload minimo viável (§7.7) -- de propósito, sem ticketId, userId, orderId, nome,
// e-mail ou qualquer outro dado de quem comprou
export interface SharedTicketView {
  event: Pick<
    EventSummary,
    'title' | 'imageUrl' | 'startsAt' | 'timezone' | 'venueName' | 'venueCity' | 'format' | 'audio' | 'roomType'
  >
  seat: TicketRecord['seat']
  ticket: { code: string; status: TicketStatus }
}

function buildShareUrl(shareToken: string): string {
  return `${env.APP_PUBLIC_URL}/share/${shareToken}`
}

function hasLiveShareLink(ticket: TicketRecord): boolean {
  return Boolean(
    ticket.shareToken &&
      !ticket.shareRevokedAt &&
      ticket.shareExpiresAt &&
      ticket.shareExpiresAt.getTime() > Date.now(),
  )
}

// nunca inclui codeHash nem qrJti -- são detalhe de implementação, não dado do
// cliente. `code` (o QR em claro) só existe no retorno de getById, nunca na listagem.
function toPublicTicket(ticket: TicketRecord): PublicTicket {
  return {
    id: ticket.id,
    status: ticket.status,
    usedAt: ticket.usedAt,
    createdAt: ticket.createdAt,
    event: ticket.event,
    seat: ticket.seat,
  }
}

export class TicketService {
  constructor(private readonly repo: TicketRepository) {}

  async listMine(userId: string, query: PaginationQuery): Promise<PaginatedResponse<PublicTicket>> {
    const { data, total } = await this.repo.findManyByUser(prisma, userId, query.page, query.limit)
    return paginate(data.map((ticket) => toPublicTicket(ticket as TicketRecord)), total, query)
  }

  async getById(id: string, userId: string): Promise<PublicTicket & { code: string }> {
    const ticket = (await this.repo.findOwnedById(prisma, id, userId)) as TicketRecord | null
    if (!ticket) throw new NotFoundError('Ingresso') // privado -- 403 confirmaria que existe (§7.6)

    const code = deriveTicketCode({ ticketId: ticket.id, eventId: ticket.eventId, jti: ticket.qrJti })
    return { ...toPublicTicket(ticket), code }
  }

  // idempotente enquanto o token vigente existir (§ etapa 09) -- chamar de novo
  // devolve o mesmo link, nunca gera um segundo token vivo
  async createShareLink(id: string, userId: string, log: Logger): Promise<ShareLink> {
    const ticket = (await this.repo.findOwnedById(prisma, id, userId)) as TicketRecord | null
    if (!ticket) throw new NotFoundError('Ingresso')

    if (ticket.status === TicketStatus.CANCELLED) {
      throw new ConflictError('TICKET_CANCELLED', 'Ingresso cancelado não gera link de compartilhamento')
    }

    if (hasLiveShareLink(ticket)) {
      return { url: buildShareUrl(ticket.shareToken as string), expiresAt: ticket.shareExpiresAt as Date }
    }

    const shareToken = randomBytes(SHARE_TOKEN_BYTES).toString('base64url')
    const shareExpiresAt = computeShareExpiresAt(ticket.event)
    await this.repo.setShareToken(prisma, id, { shareToken, shareExpiresAt })

    log.info({ msg: 'share link created', ticketId: id })
    return { url: buildShareUrl(shareToken), expiresAt: shareExpiresAt }
  }

  // idempotente: revogar um link já revogado (ou nunca criado) não é erro
  async revokeShareLink(id: string, userId: string, log: Logger): Promise<void> {
    const ticket = (await this.repo.findOwnedById(prisma, id, userId)) as TicketRecord | null
    if (!ticket) throw new NotFoundError('Ingresso')

    if (!ticket.shareToken || ticket.shareRevokedAt) return

    await this.repo.revokeShare(prisma, id)
    log.info({ msg: 'share link revoked', ticketId: id })
  }

  async getSharedTicket(shareToken: string): Promise<SharedTicketView> {
    const ticket = (await this.repo.findByShareToken(prisma, shareToken)) as TicketRecord | null
    if (!ticket) throw new AppError('SHARE_NOT_FOUND', 'Link não encontrado', 404)
    if (ticket.shareRevokedAt) throw new AppError('SHARE_REVOKED', 'Link revogado pelo dono', 410)
    if (ticket.shareExpiresAt && ticket.shareExpiresAt.getTime() < Date.now()) {
      throw new AppError('SHARE_EXPIRED', 'Link expirado', 410)
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new AppError('TICKET_CANCELLED', 'Ingresso cancelado', 410)
    }

    const code = deriveTicketCode({ ticketId: ticket.id, eventId: ticket.eventId, jti: ticket.qrJti })

    return {
      event: {
        title: ticket.event.title,
        imageUrl: ticket.event.imageUrl,
        startsAt: ticket.event.startsAt,
        timezone: ticket.event.timezone,
        venueName: ticket.event.venueName,
        venueCity: ticket.event.venueCity,
        format: ticket.event.format,
        audio: ticket.event.audio,
        roomType: ticket.event.roomType,
      },
      seat: ticket.seat,
      ticket: { code, status: ticket.status },
    }
  }
}
