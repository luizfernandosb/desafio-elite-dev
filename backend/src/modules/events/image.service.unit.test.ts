import type { Logger } from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenError, NotFoundError } from '../../shared/errors'
import { JPEG_FIXTURE, PNG_FIXTURE, TEXT_FIXTURE } from '../../test/fixtures/images'
import type { EventsRepository } from './events.repository'
import { ImageService } from './image.service'
import { InMemoryStorageProvider } from './providers/in-memory-storage.provider'

vi.mock('../../lib/prisma', () => ({ prisma: {} }))

const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as Logger

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    organizerId: 'org-1',
    imageUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    catalogImageUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    customImageKey: null,
    ...overrides,
  }
}

function makeMockRepo(): EventsRepository {
  return {
    create: vi.fn(),
    createSeats: vi.fn(),
    createSeatStates: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn((_db, _id, data) => Promise.resolve({ ...makeEvent(), ...data })),
    delete: vi.fn(),
    countTickets: vi.fn(),
    seatmap: vi.fn(),
  } as unknown as EventsRepository
}

describe('ImageService.upload', () => {
  let repo: EventsRepository
  let storage: InMemoryStorageProvider

  beforeEach(() => {
    repo = makeMockRepo()
    storage = new InMemoryStorageProvider()
  })

  it('404 -- evento inexistente', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null as never)
    const service = new ImageService(repo, storage)

    await expect(service.upload('event-1', 'org-1', JPEG_FIXTURE, log)).rejects.toThrow(NotFoundError)
  })

  it('403 -- organizador não é dono do evento', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ organizerId: 'org-2' }) as never)
    const service = new ImageService(repo, storage)

    await expect(service.upload('event-1', 'org-1', JPEG_FIXTURE, log)).rejects.toThrow(ForbiddenError)
  })

  it('400 INVALID_IMAGE -- magic bytes não batem com nenhum tipo permitido', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new ImageService(repo, storage)

    await expect(service.upload('event-1', 'org-1', TEXT_FIXTURE, log)).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
      statusHint: 400,
    })
  })

  it('sucesso -- nome gerado no servidor, extensão do tipo detectado, sem imagem antiga para remover', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent() as never)
    const service = new ImageService(repo, storage)

    const result = await service.upload('event-1', 'org-1', JPEG_FIXTURE, log)

    expect(repo.update).toHaveBeenCalledWith(
      {},
      'event-1',
      expect.objectContaining({
        imageUrl: expect.stringMatching(/^memory:\/\/events\/event-1\/[0-9A-Z]{26}\.jpg$/),
        customImageKey: expect.stringMatching(/^events\/event-1\/[0-9A-Z]{26}\.jpg$/),
      }),
    )
    expect(result.imageUrl).toMatch(/\.jpg$/)
  })

  it('troca de imagem -- remove a anterior do storage depois de salvar a nova', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ customImageKey: 'events/event-1/old.png' }) as never)
    storage.files.set('events/event-1/old.png', { buffer: PNG_FIXTURE, mimeType: 'image/png' })
    const service = new ImageService(repo, storage)

    await service.upload('event-1', 'org-1', JPEG_FIXTURE, log)

    expect(storage.files.has('events/event-1/old.png')).toBe(false)
  })
})

describe('ImageService.remove', () => {
  let repo: EventsRepository
  let storage: InMemoryStorageProvider

  beforeEach(() => {
    repo = makeMockRepo()
    storage = new InMemoryStorageProvider()
  })

  it('404 -- evento inexistente', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null as never)
    const service = new ImageService(repo, storage)

    await expect(service.remove('event-1', 'org-1', log)).rejects.toThrow(NotFoundError)
  })

  it('403 -- organizador não é dono do evento', async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeEvent({ organizerId: 'org-2' }) as never)
    const service = new ImageService(repo, storage)

    await expect(service.remove('event-1', 'org-1', log)).rejects.toThrow(ForbiddenError)
  })

  it('idempotente -- evento já está no pôster do catálogo, não chama update nem storage', async () => {
    const event = makeEvent({ customImageKey: null })
    vi.mocked(repo.findById).mockResolvedValue(event as never)
    const service = new ImageService(repo, storage)

    const result = await service.remove('event-1', 'org-1', log)

    expect(result).toBe(event)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('reverte para o pôster do catálogo e remove o upload do storage', async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      makeEvent({ customImageKey: 'events/event-1/custom.jpg', catalogImageUrl: 'https://tmdb/poster.jpg' }) as never,
    )
    storage.files.set('events/event-1/custom.jpg', { buffer: JPEG_FIXTURE, mimeType: 'image/jpeg' })
    const service = new ImageService(repo, storage)

    await service.remove('event-1', 'org-1', log)

    expect(repo.update).toHaveBeenCalledWith({}, 'event-1', {
      imageUrl: 'https://tmdb/poster.jpg',
      customImageKey: null,
    })
    expect(storage.files.has('events/event-1/custom.jpg')).toBe(false)
  })
})
