import type { Logger } from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventStatus } from '../../../generated/prisma/enums'
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from '../../shared/errors'
import type { CatalogItem } from '../catalog/catalog.types'
import type { CatalogService } from '../catalog/catalog.service'
import type { EventsRepository } from './events.repository'
import { EventsService } from './events.service'

vi.mock('../../lib/prisma', () => ({
  prisma: { $transaction: (callback: (tx: string) => unknown) => callback('fake-tx') },
}))

const CATALOG_ITEM: CatalogItem = {
  source: 'TMDB' as never,
  externalId: '603',
  title: 'The Matrix',
  subtitle: 'Bem-vindo ao mundo real.',
  synopsis: 'Um hacker descobre a verdade.',
  imageUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
  runtimeMinutes: 136,
  genres: ['Ação'],
}

const CREATE_DTO = {
  source: 'TMDB' as never,
  externalId: '603',
  venueName: 'Cine Belas Artes',
  venueCity: 'São Paulo',
  venueState: 'SP' as never,
  startsAt: new Date(Date.now() + 86_400_000),
  timezone: 'America/Sao_Paulo',
  priceInCents: 3200,
  layout: { rows: 8, seatsPerRow: 12 },
  format: 'TWO_D' as never,
  audio: 'DUBBED' as never,
  roomType: 'STANDARD' as never,
}

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    organizerId: 'org-1',
    status: EventStatus.DRAFT,
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: null,
    priceInCents: 3200,
    _count: { tickets: 0 },
    ...overrides,
  }
}

function makeMockRepo(): EventsRepository {
  return {
    create: vi.fn().mockResolvedValue({ id: 'event-1' }),
    createSeats: vi.fn(),
    createSeatStates: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countTickets: vi.fn(),
    seatmap: vi.fn(),
  } as unknown as EventsRepository
}

function makeMockCatalogService(): CatalogService {
  return { getById: vi.fn().mockResolvedValue(CATALOG_ITEM) } as unknown as CatalogService
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

describe('EventsService.create', () => {
  it('copia o snapshot do catálogo e usa o organizerId do parâmetro, nunca do DTO', async () => {
    const repo = makeMockRepo()
    const catalogService = makeMockCatalogService()
    const service = new EventsService(repo, catalogService)

    await service.create('org-1', CREATE_DTO, log)

    expect(catalogService.getById).toHaveBeenCalledWith('603', log)
    expect(repo.create).toHaveBeenCalledWith(
      'fake-tx',
      expect.objectContaining({
        organizerId: 'org-1',
        title: CATALOG_ITEM.title,
        subtitle: CATALOG_ITEM.subtitle,
        synopsis: CATALOG_ITEM.synopsis,
        imageUrl: CATALOG_ITEM.imageUrl,
        runtimeMinutes: CATALOG_ITEM.runtimeMinutes,
        genres: CATALOG_ITEM.genres,
        status: EventStatus.DRAFT,
      }),
    )
  })

  it('gera os assentos e os SeatState na mesma transação que o Event', async () => {
    const repo = makeMockRepo()
    const service = new EventsService(repo, makeMockCatalogService())

    await service.create('org-1', CREATE_DTO, log)

    expect(repo.createSeats).toHaveBeenCalledWith('fake-tx', expect.any(Array))
    expect(repo.createSeatStates).toHaveBeenCalledWith('fake-tx', expect.any(Array))
    const seatsArg = vi.mocked(repo.createSeats).mock.calls[0]?.[1] as unknown[]
    expect(seatsArg).toHaveLength(96) // 8 x 12
  })
})

describe('EventsService.update', () => {
  let repo: EventsRepository

  beforeEach(() => {
    repo = makeMockRepo()
  })

  it('bloqueia campos que alteram o contrato de compra quando há vendas', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ _count: { tickets: 3 } }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(
      service.update('event-1', 'org-1', { priceInCents: 5000 }, log),
    ).rejects.toThrow(ConflictError)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('permite campos que não alteram o contrato mesmo com vendas', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ _count: { tickets: 3 } }) as never)
    vi.mocked(repo.update).mockResolvedValue(makeEvent() as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await service.update('event-1', 'org-1', { synopsis: 'Nova sinopse' }, log)
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), 'event-1', { synopsis: 'Nova sinopse' })
  })

  it('403 -- organizador que não é dono não pode editar', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ organizerId: 'outro-org' }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.update('event-1', 'org-1', { synopsis: 'x' }, log)).rejects.toThrow(ForbiddenError)
  })

  it('rejeita startsAt no passado', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(
      service.update('event-1', 'org-1', { startsAt: new Date(Date.now() - 1000) }, log),
    ).rejects.toThrow(ValidationError)
  })
})

describe('EventsService.remove', () => {
  it('409 -- evento PUBLISHED não pode ser removido', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ status: EventStatus.PUBLISHED }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.remove('event-1', 'org-1', log)).rejects.toThrow(ConflictError)
  })

  it('409 -- evento DRAFT com ingresso vendido não pode ser removido', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ _count: { tickets: 1 } }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.remove('event-1', 'org-1', log)).rejects.toThrow(ConflictError)
  })

  it('remove um DRAFT sem vendas', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await service.remove('event-1', 'org-1', log)
    expect(repo.delete).toHaveBeenCalledWith(expect.anything(), 'event-1')
  })
})

describe('EventsService.publish', () => {
  it('lança InvalidTransitionError a partir de CANCELLED', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ status: EventStatus.CANCELLED }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.publish('event-1', 'org-1', log)).rejects.toThrow(InvalidTransitionError)
  })

  it('rejeita publicar evento com startsAt no passado', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(
      makeEvent({ startsAt: new Date(Date.now() - 1000) }) as never,
    )
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.publish('event-1', 'org-1', log)).rejects.toThrow(ConflictError)
  })

  it('publica um DRAFT com startsAt no futuro', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    vi.mocked(repo.update).mockResolvedValue(makeEvent({ status: EventStatus.PUBLISHED }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await service.publish('event-1', 'org-1', log)
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), 'event-1', { status: EventStatus.PUBLISHED })
  })
})

describe('EventsService.getById -- visibilidade', () => {
  it('404 para DRAFT quando o requisitante não é o dono', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.getById('event-1', { id: 'outro-user', role: 'ORGANIZER' })).rejects.toThrow(
      NotFoundError,
    )
  })

  it('404 para DRAFT quando não há requisitante (anônimo)', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(service.getById('event-1', undefined)).rejects.toThrow(NotFoundError)
  })

  it('200 para DRAFT quando o requisitante é o dono', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new EventsService(repo, makeMockCatalogService())

    const event = await service.getById('event-1', { id: 'org-1', role: 'ORGANIZER' })
    expect(event.id).toBe('event-1')
  })

  it('PUBLISHED é visível para qualquer um, inclusive anônimo', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ status: EventStatus.PUBLISHED }) as never)
    const service = new EventsService(repo, makeMockCatalogService())

    const event = await service.getById('event-1', undefined)
    expect(event.id).toBe('event-1')
  })
})

describe('EventsService.list -- visibilidade', () => {
  it('403 -- cliente não pode listar DRAFT', async () => {
    const repo = makeMockRepo()
    const service = new EventsService(repo, makeMockCatalogService())

    await expect(
      service.list(
        { page: 1, limit: 20, status: EventStatus.DRAFT } as never,
        { id: 'user-1', role: 'CUSTOMER' },
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it('escopa DRAFT pelo próprio organizerId', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findMany).mockResolvedValue({ data: [], total: 0 })
    const service = new EventsService(repo, makeMockCatalogService())

    await service.list(
      { page: 1, limit: 20, status: EventStatus.DRAFT } as never,
      { id: 'org-1', role: 'ORGANIZER' },
    )

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizerId: 'org-1', status: EventStatus.DRAFT }),
      0,
      20,
    )
  })

  it('repassa externalId pro repositório -- tela de detalhe lista só sessões do mesmo filme', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.findMany).mockResolvedValue({ data: [], total: 0 })
    const service = new EventsService(repo, makeMockCatalogService())

    await service.list(
      { page: 1, limit: 20, status: EventStatus.PUBLISHED, externalId: '693134' } as never,
      undefined,
    )

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalId: '693134' }),
      0,
      20,
    )
  })
})
