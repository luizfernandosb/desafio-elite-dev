import type { CatalogSource } from '../../../generated/prisma/enums'
import { AppError } from '../../shared/errors'

// Snapshot normalizado de um item de catálogo -- nunca um proxy. Copiado para `Event`
// na criação; depois disso nada mais consulta o provedor externo (§4.3).
export interface CatalogItem {
  source: CatalogSource
  externalId: string
  title: string
  subtitle?: string
  synopsis?: string
  imageUrl?: string
  runtimeMinutes?: number
  genres: string[]
  // classificação indicativa brasileira ("L", "10", "12", "14", "16", "18") --
  // só vem preenchida no detalhe (getById), nunca na busca (§ tmdb.provider.ts)
  ageRating?: string
}

// mesmo `code` pode carregar dois status diferentes: 500 quando o problema é nosso
// (credencial errada), 503 quando é do provedor externo (rede, timeout, 5xx dele)
export class CatalogUnavailableError extends AppError {
  constructor(message = 'Catálogo indisponível', statusHint: 500 | 503 = 503) {
    super('CATALOG_UNAVAILABLE', message, statusHint)
  }
}

export class CatalogRateLimitedError extends AppError {
  constructor() {
    super('CATALOG_RATE_LIMITED', 'Catálogo temporariamente indisponível', 503)
  }
}
