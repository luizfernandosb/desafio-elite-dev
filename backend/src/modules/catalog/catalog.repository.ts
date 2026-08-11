import type { CatalogSource } from '../../../generated/prisma/enums'
import type { Prisma } from '../../../generated/prisma/client'
import type { Db } from '../../shared/db'

interface UpsertInput {
  source: CatalogSource
  cacheKey: string
  payload: Prisma.InputJsonValue
  expiresAt: Date
}

export class CatalogRepository {
  async findFresh(db: Db, source: CatalogSource, cacheKey: string) {
    const entry = await db.catalogCache.findUnique({ where: { source_cacheKey: { source, cacheKey } } })
    if (!entry || entry.expiresAt <= new Date()) return null
    return entry
  }

  findAny(db: Db, source: CatalogSource, cacheKey: string) {
    return db.catalogCache.findUnique({ where: { source_cacheKey: { source, cacheKey } } })
  }

  upsert(db: Db, data: UpsertInput) {
    return db.catalogCache.upsert({
      where: { source_cacheKey: { source: data.source, cacheKey: data.cacheKey } },
      create: data,
      update: { payload: data.payload, expiresAt: data.expiresAt },
    })
  }
}
