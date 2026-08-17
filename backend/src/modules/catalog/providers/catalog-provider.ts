import type { CatalogSource } from '../../../../generated/prisma/enums'
import type { CatalogItem } from '../catalog.types'

export interface CatalogSearchResult {
  items: CatalogItem[]
  total: number
}

export interface CatalogProvider {
  readonly source: CatalogSource
  search(query: string, page: number): Promise<CatalogSearchResult>
  getById(externalId: string): Promise<CatalogItem>
}
