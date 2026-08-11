import type { CatalogSource } from '../../../../generated/prisma/enums'
import type { CatalogItem } from '../catalog.types'

export interface CatalogSearchResult {
  items: CatalogItem[]
  total: number
}

// Interface desde o primeiro commit -- é o que torna "Ticketmaster sem migração" uma
// afirmação verificável, não uma promessa (§4.3).
export interface CatalogProvider {
  readonly source: CatalogSource
  search(query: string, page: number): Promise<CatalogSearchResult>
  getById(externalId: string): Promise<CatalogItem>
}
