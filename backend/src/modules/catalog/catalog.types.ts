import type { CatalogSource } from '../../../generated/prisma/enums'
import { AppError } from '../../shared/errors'

export interface CatalogItem {
  source: CatalogSource
  externalId: string
  title: string
  subtitle?: string
  synopsis?: string
  imageUrl?: string
  runtimeMinutes?: number
  genres: string[]
  ageRating?: string
}

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
