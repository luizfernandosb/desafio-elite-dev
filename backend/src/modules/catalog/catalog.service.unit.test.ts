import type { Logger } from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogSource } from '../../../generated/prisma/enums'
import { CatalogUnavailableError, type CatalogItem } from './catalog.types'
import type { CatalogRepository } from './catalog.repository'
import { CatalogService } from './catalog.service'
import type { CatalogProvider, CatalogSearchResult } from './providers/catalog-provider'

const MATRIX: CatalogItem = {
  source: CatalogSource.TMDB,
  externalId: '603',
  title: 'The Matrix',
  genres: ['Ação'],
}

const SEARCH_RESULT: CatalogSearchResult = { items: [MATRIX], total: 1 }

function makeMockRepo(): CatalogRepository {
  return { findFresh: vi.fn(), findAny: vi.fn(), upsert: vi.fn() } as unknown as CatalogRepository
}

function makeMockProvider(): CatalogProvider {
  return { source: CatalogSource.TMDB, search: vi.fn(), getById: vi.fn() }
}

const logMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
const log = logMock as unknown as Logger

describe('CatalogService.search', () => {
  let repo: CatalogRepository
  let provider: CatalogProvider

  beforeEach(() => {
    repo = makeMockRepo()
    provider = makeMockProvider()
  })

  it('cache fresco -- não chama o provider', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue({
      payload: SEARCH_RESULT,
      expiresAt: new Date(Date.now() + 60_000),
    } as never)

    const service = new CatalogService(repo, provider)
    const result = await service.search('matrix', 1, log)

    expect(result.data).toEqual([MATRIX])
    expect(result.meta.stale).toBeUndefined()
    expect(provider.search).not.toHaveBeenCalled()
  })

  it('cache miss -- chama o provider e grava o resultado', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue(null)
    vi.mocked(provider.search).mockResolvedValue(SEARCH_RESULT)

    const service = new CatalogService(repo, provider)
    const result = await service.search('matrix', 1, log)

    expect(provider.search).toHaveBeenCalledWith('matrix', 1)
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cacheKey: 'search:matrix:1:pt-BR' }),
    )
    expect(result.data).toEqual([MATRIX])
    expect(result.meta.total).toBe(1)
  })

  it('provider falha e existe cache vencido -- devolve stale: true em vez de propagar o erro', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue(null)
    vi.mocked(provider.search).mockRejectedValue(new CatalogUnavailableError())
    vi.mocked(repo.findAny).mockResolvedValue({
      payload: SEARCH_RESULT,
      expiresAt: new Date(Date.now() - 60_000),
    } as never)

    const service = new CatalogService(repo, provider)
    const result = await service.search('matrix', 1, log)

    expect(result.data).toEqual([MATRIX])
    expect(result.meta.stale).toBe(true)
  })

  it('provider falha e não há cache nenhum -- propaga o erro', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue(null)
    vi.mocked(provider.search).mockRejectedValue(new CatalogUnavailableError())
    vi.mocked(repo.findAny).mockResolvedValue(null)

    const service = new CatalogService(repo, provider)
    await expect(service.search('matrix', 1, log)).rejects.toThrow(CatalogUnavailableError)
  })

  it('erro 500 (credencial errada) loga em nível error, além do tratamento normal', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue(null)
    vi.mocked(provider.search).mockRejectedValue(new CatalogUnavailableError('x', 500))
    vi.mocked(repo.findAny).mockResolvedValue(null)

    const service = new CatalogService(repo, provider)
    await expect(service.search('matrix', 1, log)).rejects.toThrow(CatalogUnavailableError)
    expect(logMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('misconfigured') }),
    )
  })
})

describe('CatalogService.getById', () => {
  let repo: CatalogRepository
  let provider: CatalogProvider

  beforeEach(() => {
    repo = makeMockRepo()
    provider = makeMockProvider()
  })

  it('cache fresco -- não chama o provider', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue({ payload: MATRIX } as never)

    const service = new CatalogService(repo, provider)
    const result = await service.getById('603', log)

    expect(result).toEqual(MATRIX)
    expect(provider.getById).not.toHaveBeenCalled()
  })

  it('provider falha e existe cache vencido -- devolve stale: true', async () => {
    vi.mocked(repo.findFresh).mockResolvedValue(null)
    vi.mocked(provider.getById).mockRejectedValue(new CatalogUnavailableError())
    vi.mocked(repo.findAny).mockResolvedValue({ payload: MATRIX } as never)

    const service = new CatalogService(repo, provider)
    const result = await service.getById('603', log)

    expect(result).toEqual({ ...MATRIX, stale: true })
  })
})
