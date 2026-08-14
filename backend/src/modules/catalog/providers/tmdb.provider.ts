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
// título/sinopse/gêneros localizados quando o TMDb tiver tradução para o filme --
// sem isto, a API devolve en-US (default) mesmo pra quem só lê PT-BR na tela.
// TMDb cai de volta pro idioma original quando não existe tradução, nunca erro.
const TMDB_LANGUAGE = 'pt-BR'

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

interface TmdbReleaseDatesResponse {
  results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }>
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
      `/search/movie?query=${encodeURIComponent(query)}&page=${page}&language=${TMDB_LANGUAGE}`,
    )
    const genreMap = await this.getGenreMap()

    return {
      items: data.results.map((movie) => this.normalizeSummary(movie, genreMap)),
      total: data.total_results,
    }
  }

  async getById(externalId: string): Promise<CatalogItem> {
    const id = encodeURIComponent(externalId)
    const [movie, ageRating] = await Promise.all([
      this.request<TmdbMovieDetail>(`/movie/${id}?language=${TMDB_LANGUAGE}`),
      this.getBrCertification(id),
    ])
    return this.normalizeDetail(movie, ageRating)
  }

  // classificação indicativa não vem em /movie/{id} -- só em /release_dates, por
  // país. Auxiliar, mesmo raciocínio de `getGenreMap()`: se falhar (rede, país sem
  // entrada BR, TMDb fora do ar), o evento ainda é criado, só sem classificação --
  // nunca derruba a criação por causa de um dado secundário.
  private async getBrCertification(id: string): Promise<string | undefined> {
    try {
      const data = await this.request<TmdbReleaseDatesResponse>(`/movie/${id}/release_dates`)
      const brEntry = data.results.find((entry) => entry.iso_3166_1 === 'BR')
      return brEntry?.release_dates.find((release) => release.certification)?.certification || undefined
    } catch {
      return undefined
    }
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

  private normalizeDetail(movie: TmdbMovieDetail, ageRating?: string): CatalogItem {
    return {
      source: this.source,
      externalId: String(movie.id),
      title: movie.title,
      subtitle: movie.tagline || undefined,
      synopsis: movie.overview ?? undefined,
      imageUrl: toImageUrl(movie.poster_path),
      runtimeMinutes: movie.runtime ?? undefined,
      genres: movie.genres.map((genre) => genre.name),
      ageRating,
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
      const data = await this.request<TmdbGenreListResponse>(`/genre/movie/list?language=${TMDB_LANGUAGE}`)
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
