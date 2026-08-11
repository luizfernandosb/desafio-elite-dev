import { CatalogSource } from '../../../../generated/prisma/enums'
import { env } from '../../../config/env'
import { NotFoundError } from '../../../shared/errors'
import { CatalogRateLimitedError, CatalogUnavailableError, type CatalogItem } from '../catalog.types'
import type { CatalogProvider, CatalogSearchResult } from './catalog-provider'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
const REQUEST_TIMEOUT_MS = 5000
const RETRY_BACKOFF_MS = 300
const GENRE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface TmdbMovieSummary {
  id: number
  title: string
  overview: string | null
  poster_path: string | null
  genre_ids?: number[]
}

interface TmdbMovieDetail {
  id: number
  title: string
  tagline: string | null
  overview: string | null
  poster_path: string | null
  runtime: number | null
  genres: Array<{ id: number; name: string }>
}

interface TmdbSearchResponse {
  results: TmdbMovieSummary[]
  total_results: number
}

interface TmdbGenreListResponse {
  genres: Array<{ id: number; name: string }>
}

function toImageUrl(posterPath: string | null): string | undefined {
  return posterPath ? `${IMAGE_BASE_URL}${posterPath}` : undefined
}

export class TmdbProvider implements CatalogProvider {
  readonly source = CatalogSource.TMDB

  private genreCache: { map: Map<number, string>; expiresAt: number } | undefined

  async search(query: string, page: number): Promise<CatalogSearchResult> {
    const data = await this.request<TmdbSearchResponse>(
      `/search/movie?query=${encodeURIComponent(query)}&page=${page}`,
    )
    const genreMap = await this.getGenreMap()

    return {
      items: data.results.map((movie) => this.normalizeSummary(movie, genreMap)),
      total: data.total_results,
    }
  }

  async getById(externalId: string): Promise<CatalogItem> {
    const movie = await this.request<TmdbMovieDetail>(`/movie/${encodeURIComponent(externalId)}`)
    return this.normalizeDetail(movie)
  }

  private normalizeSummary(movie: TmdbMovieSummary, genreMap: Map<number, string>): CatalogItem {
    return {
      source: this.source,
      externalId: String(movie.id),
      title: movie.title,
      synopsis: movie.overview ?? undefined,
      imageUrl: toImageUrl(movie.poster_path),
      genres: (movie.genre_ids ?? [])
        .map((id) => genreMap.get(id))
        .filter((name): name is string => Boolean(name)),
    }
  }

  private normalizeDetail(movie: TmdbMovieDetail): CatalogItem {
    return {
      source: this.source,
      externalId: String(movie.id),
      title: movie.title,
      subtitle: movie.tagline || undefined,
      synopsis: movie.overview ?? undefined,
      imageUrl: toImageUrl(movie.poster_path),
      runtimeMinutes: movie.runtime ?? undefined,
      genres: movie.genres.map((genre) => genre.name),
    }
  }

  // genre_ids só vem na busca -- nomes exigem /genre/movie/list, cacheado em memória
  // por 24h (não na tabela CatalogCache: é auxiliar de normalização, não um item de
  // catálogo, e não pode exigir banco para o provider ser testável em isolamento)
  private async getGenreMap(): Promise<Map<number, string>> {
    if (this.genreCache && this.genreCache.expiresAt > Date.now()) {
      return this.genreCache.map
    }

    try {
      const data = await this.request<TmdbGenreListResponse>('/genre/movie/list')
      const map = new Map(data.genres.map((genre) => [genre.id, genre.name] as const))
      this.genreCache = { map, expiresAt: Date.now() + GENRE_CACHE_TTL_MS }
      return map
    } catch {
      // lista de gêneros é auxiliar -- a busca não falha por causa dela
      return this.genreCache?.map ?? new Map()
    }
  }

  private async request<T>(path: string, attempt = 0): Promise<T> {
    let response: globalThis.Response
    try {
      response = await fetch(`${TMDB_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${env.TMDB_API_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      // erro de rede ou timeout -- 1 retry com backoff, nunca mais que isso
      if (attempt === 0) return this.retryAfterBackoff<T>(path, attempt)
      throw new CatalogUnavailableError('Catálogo indisponível', 503)
    }

    if (response.ok) return (await response.json()) as T

    // 4xx nunca tenta de novo
    if (response.status === 404) throw new NotFoundError('Filme')
    if (response.status === 429) throw new CatalogRateLimitedError()
    if (response.status === 401 || response.status === 403) {
      // chave errada é problema nosso, não do usuário -- log.error fica a cargo do
      // Service, que tem o logger com requestId (§5.5.7)
      throw new CatalogUnavailableError('Catálogo indisponível', 500)
    }

    // 5xx do TMDb -- 1 retry com backoff
    if (response.status >= 500 && attempt === 0) {
      return this.retryAfterBackoff<T>(path, attempt)
    }

    throw new CatalogUnavailableError('Catálogo indisponível', 503)
  }

  private async retryAfterBackoff<T>(path: string, attempt: number): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS))
    return this.request<T>(path, attempt + 1)
  }
}
