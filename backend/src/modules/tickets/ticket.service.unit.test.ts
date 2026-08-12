import type { Logger } from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketStatus } from '../../../generated/prisma/enums'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors'
import type { TicketRepository } from './ticket.repository'
import { TicketService } from './ticket.service'

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

const EVENT = {
  id: 'event-1',
  title: 'Show de teste',
  imageUrl: null,
  startsAt: new Date(Date.now() + 86_400_000),
  endsAt: null,
  timezone: 'America/Sao_Paulo',
  venueName: 'Arena',
  venueCity: 'São Paulo',
}

function makeTicket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ticket-1',
    status: TicketStatus.ACTIVE,
    usedAt: null,
    createdAt: new Date(),
    eventId: EVENT.id,
    qrJti: 'jti-abc',
    shareToken: null,
    shareExpiresAt: null,
    shareRevokedAt: null,
    event: EVENT,
    seat: { row: 'A', number: 1 },
    ...overrides,
  }
}

function makeMockRepo(): TicketRepository {
  return {
    create: vi.fn(),
    findByOrderId: vi.fn(),
    findManyByUser: vi.fn(),
    findOwnedById: vi.fn(),
    setShareToken: vi.fn(),
    revokeShare: vi.fn(),
    findByShareToken: vi.fn(),
  } as unknown as TicketRepository
}

describe('TicketService.createShareLink', () => {
  let repo: TicketRepository

  beforeEach(() => {
    repo = makeMockRepo()
  })

  it('404 -- ingresso não existe ou não é do usuário', async () => {
    vi.mocked(repo.findOwnedById).mockResolvedValue(null)
    const service = new TicketService(repo)
    await expect(service.createShareLink('ticket-1', 'user-1', log)).rejects.toThrow(NotFoundError)
  })

  it('409 -- ingresso CANCELLED não gera link', async () => {
    vi.mocked(repo.findOwnedById).mockResolvedValue(makeTicket({ status: TicketStatus.CANCELLED }) as never)
    const service = new TicketService(repo)
    await expect(service.createShareLink('ticket-1', 'user-1', log)).rejects.toThrow(ConflictError)
    expect(repo.setShareToken).not.toHaveBeenCalled()
  })

  it('gera um token novo (>= 32 bytes de entropia) quando não há link vigente', async () => {
    vi.mocked(repo.findOwnedById).mockResolvedValue(makeTicket() as never)
    const service = new TicketService(repo)

    const link = await service.createShareLink('ticket-1', 'user-1', log)

    expect(repo.setShareToken).toHaveBeenCalledTimes(1)
    const [, , data] = vi.mocked(repo.setShareToken).mock.calls[0] as unknown as [unknown, unknown, { shareToken: string }]
    // base64url de 32 bytes -> 43 caracteres, sem padding
    expect(data.shareToken).toHaveLength(43)
    expect(data.shareToken).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(link.url).toContain(data.shareToken)
  })

  it('idempotente: link vigente (não revogado, não expirado) devolve o mesmo token sem gravar de novo', async () => {
    const ticket = makeTicket({
      shareToken: 'token-vigente',
      shareExpiresAt: new Date(Date.now() + 60_000),
    })
    vi.mocked(repo.findOwnedById).mockResolvedValue(ticket as never)
    const service = new TicketService(repo)

    const link = await service.createShareLink('ticket-1', 'user-1', log)

    expect(repo.setShareToken).not.toHaveBeenCalled()
    expect(link.url).toContain('token-vigente')
  })

  it('token revogado -- gera um token novo, não reaproveita', async () => {
    const ticket = makeTicket({
      shareToken: 'token-antigo',
      shareExpiresAt: new Date(Date.now() + 60_000),
      shareRevokedAt: new Date(),
    })
    vi.mocked(repo.findOwnedById).mockResolvedValue(ticket as never)
    const service = new TicketService(repo)

    await service.createShareLink('ticket-1', 'user-1', log)
    expect(repo.setShareToken).toHaveBeenCalledTimes(1)
  })

  it('token expirado -- gera um token novo, não reaproveita', async () => {
    const ticket = makeTicket({
      shareToken: 'token-vencido',
      shareExpiresAt: new Date(Date.now() - 60_000),
    })
    vi.mocked(repo.findOwnedById).mockResolvedValue(ticket as never)
    const service = new TicketService(repo)

    await service.createShareLink('ticket-1', 'user-1', log)
    expect(repo.setShareToken).toHaveBeenCalledTimes(1)
  })

  it('dois ingressos diferentes geram tokens distintos', async () => {
    vi.mocked(repo.findOwnedById)
      .mockResolvedValueOnce(makeTicket({ id: 'ticket-1' }) as never)
      .mockResolvedValueOnce(makeTicket({ id: 'ticket-2' }) as never)
    const service = new TicketService(repo)

    const first = await service.createShareLink('ticket-1', 'user-1', log)
    const second = await service.createShareLink('ticket-2', 'user-1', log)

    expect(first.url).not.toBe(second.url)
  })
})

describe('TicketService.revokeShareLink', () => {
  it('404 -- ingresso não existe ou não é do usuário', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findOwnedById).mockResolvedValue(null)
    const service = new TicketService(repo)
    await expect(service.revokeShareLink('ticket-1', 'user-1', log)).rejects.toThrow(NotFoundError)
  })

  it('idempotente -- sem link vigente não chama revokeShare', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findOwnedById).mockResolvedValue(makeTicket() as never)
    const service = new TicketService(repo)

    await service.revokeShareLink('ticket-1', 'user-1', log)
    expect(repo.revokeShare).not.toHaveBeenCalled()
  })

  it('revoga um link vigente', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findOwnedById).mockResolvedValue(
      makeTicket({ shareToken: 'token-1', shareExpiresAt: new Date(Date.now() + 60_000) }) as never,
    )
    const service = new TicketService(repo)

    await service.revokeShareLink('ticket-1', 'user-1', log)
    expect(repo.revokeShare).toHaveBeenCalledWith(expect.anything(), 'ticket-1')
  })
})

describe('TicketService.getSharedTicket', () => {
  it('404 SHARE_NOT_FOUND -- token inexistente', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findByShareToken).mockResolvedValue(null)
    const service = new TicketService(repo)

    const err = await service.getSharedTicket('token-x').catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('SHARE_NOT_FOUND')
    expect(err.statusHint).toBe(404)
  })

  it('410 SHARE_REVOKED', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findByShareToken).mockResolvedValue(
      makeTicket({ shareToken: 'token-x', shareRevokedAt: new Date() }) as never,
    )
    const service = new TicketService(repo)

    const err = await service.getSharedTicket('token-x').catch((e) => e)
    expect(err.code).toBe('SHARE_REVOKED')
    expect(err.statusHint).toBe(410)
  })

  it('410 SHARE_EXPIRED', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findByShareToken).mockResolvedValue(
      makeTicket({ shareToken: 'token-x', shareExpiresAt: new Date(Date.now() - 1000) }) as never,
    )
    const service = new TicketService(repo)

    const err = await service.getSharedTicket('token-x').catch((e) => e)
    expect(err.code).toBe('SHARE_EXPIRED')
    expect(err.statusHint).toBe(410)
  })

  it('410 TICKET_CANCELLED', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findByShareToken).mockResolvedValue(
      makeTicket({
        shareToken: 'token-x',
        shareExpiresAt: new Date(Date.now() + 60_000),
        status: TicketStatus.CANCELLED,
      }) as never,
    )
    const service = new TicketService(repo)

    const err = await service.getSharedTicket('token-x').catch((e) => e)
    expect(err.code).toBe('TICKET_CANCELLED')
    expect(err.statusHint).toBe(410)
  })

  it('200 -- payload mínimo, sem ticketId, userId, orderId, nome ou e-mail', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findByShareToken).mockResolvedValue(
      makeTicket({ shareToken: 'token-x', shareExpiresAt: new Date(Date.now() + 60_000) }) as never,
    )
    const service = new TicketService(repo)

    const view = await service.getSharedTicket('token-x')

    expect(view).toEqual({
      event: {
        title: EVENT.title,
        imageUrl: EVENT.imageUrl,
        startsAt: EVENT.startsAt,
        timezone: EVENT.timezone,
        venueName: EVENT.venueName,
        venueCity: EVENT.venueCity,
      },
      seat: { row: 'A', number: 1 },
      ticket: { code: expect.any(String), status: TicketStatus.ACTIVE },
    })
    const serialized = JSON.stringify(view)
    for (const forbidden of ['ticketId', 'userId', 'orderId', 'email', 'name', 'ticket-1']) {
      expect(serialized).not.toContain(forbidden)
    }
  })
})
