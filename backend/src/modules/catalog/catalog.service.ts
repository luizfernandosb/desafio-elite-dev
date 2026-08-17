import type { Logger } from 'pino'
import { prisma } from '../../lib/prisma'
import { paginate, type PaginatedResponse } from '../../shared/pagination'
import { CatalogUnavailableError, type CatalogItem } from './catalog.types'
import type { CatalogRepository } from './catalog.repository'
import type { CatalogProvider, CatalogSearchResult } from './providers/catalog-provider'

const SEARCH_PAGE_SIZE = 20
const SEARCH_TTL_MS = 10 * 60 * 1000
const DETAIL_TTL_MS = 60 * 60 * 1000

export type CatalogSearchResponse = PaginatedResponse<CatalogItem> & {
  meta: PaginatedResponse<CatalogItem>['meta'] & { stale?: boolean }
}

export type CatalogDetailResponse = CatalogItem & { stale?: boolean }

export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly provider: CatalogProvider,
  ) {}

  async search(query: string, page: number, log: Logger): Promise<CatalogSearchResponse> {
    const cacheKey = `search:${query.trim().toLowerCase()}:${page}:pt-BR`

    const fresh = await this.repo.findFresh(prisma, this.provider.source, cacheKey)
    if (fresh) {
      log.debug({ msg: 'catalog cache hit', cacheKey })
      return this.toSearchResponse(fresh.payload as unknown as CatalogSearchResult, page)
    }

    try {
      const result = await this.provider.search(query, page)
      await this.repo.upsert(prisma, {
        source: this.provider.source,
        cacheKey,
        payload: result as never,
        expiresAt: new Date(Date.now() + SEARCH_TTL_MS),
      })
      return this.toSearchResponse(result, page)
    } catch (err) {
      this.logIfMisconfigured(err, log)

      const stale = await this.repo.findAny(prisma, this.provider.source, cacheKey)
      if (!stale) throw err

      log.warn({ msg: 'catalog provider failed -- serving stale cache', cacheKey, err })
      const response = this.toSearchResponse(stale.payload as unknown as CatalogSearchResult, page)
      return { ...response, meta: { ...response.meta, stale: true } }
    }
  }

  async getById(externalId: string, log: Logger): Promise<CatalogDetailResponse> {
    const cacheKey = `movie:${externalId}:pt-BR`

    const fresh = await this.repo.findFresh(prisma, this.provider.source, cacheKey)
    if (fresh) {
      log.debug({ msg: 'catalog cache hit', cacheKey })
      return fresh.payload as unknown as CatalogItem
    }

    try {
      const item = await this.provider.getById(externalId)
      await this.repo.upsert(prisma, {
        source: this.provider.source,
        cacheKey,
        payload: item as never,
        expiresAt: new Date(Date.now() + DETAIL_TTL_MS),
      })
      return item
    } catch (err) {
      this.logIfMisconfigured(err, log)

      const stale = await this.repo.findAny(prisma, this.provider.source, cacheKey)
      if (!stale) throw err

      log.warn({ msg: 'catalog provider failed -- serving stale cache', cacheKey, err })
      return { ...(stale.payload as unknown as CatalogItem), stale: true }
    }
  }

  private toSearchResponse(result: CatalogSearchResult, page: number): CatalogSearchResponse {
    return paginate(result.items, result.total, { page, limit: SEARCH_PAGE_SIZE })
  }

  private logIfMisconfigured(err: unknown, log: Logger): void {
    if (err instanceof CatalogUnavailableError && err.statusHint === 500) {
      log.error({ msg: 'catalog provider misconfigured -- check API credentials', err })
    }
  }
}
