import { LocationsUnavailableError, type CityOption, type StateOption } from './locations.types'

const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades'
const REQUEST_TIMEOUT_MS = 5000
const RETRY_BACKOFF_MS = 300
// estados e municípios do IBGE não mudam de um dia para o outro -- cache em memória
// simples é suficiente, mesmo padrão do `genreCache` de tmdb.provider.ts (etapa 04)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface IbgeLocality {
  id: number
  nome: string
  sigla?: string
}

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export class LocationsService {
  private statesCache: CacheEntry<StateOption[]> | undefined
  private citiesCache = new Map<string, CacheEntry<CityOption[]>>()

  async getStates(): Promise<StateOption[]> {
    if (this.statesCache && this.statesCache.expiresAt > Date.now()) return this.statesCache.data

    try {
      const data = await this.request<IbgeLocality[]>('/estados?orderBy=nome')
      const states = data.map((state) => ({ id: state.id, sigla: state.sigla ?? '', nome: state.nome }))
      this.statesCache = { data: states, expiresAt: Date.now() + CACHE_TTL_MS }
      return states
    } catch (err) {
      // dado de ontem é melhor que erro -- estados não mudam de um dia para o outro
      if (this.statesCache) return this.statesCache.data
      throw err
    }
  }

  async getCities(uf: string): Promise<CityOption[]> {
    const key = uf.toUpperCase()
    const cached = this.citiesCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    try {
      const data = await this.request<IbgeLocality[]>(`/estados/${key}/municipios?orderBy=nome`)
      const cities = data.map((city) => ({ id: city.id, nome: city.nome }))
      this.citiesCache.set(key, { data: cities, expiresAt: Date.now() + CACHE_TTL_MS })
      return cities
    } catch (err) {
      if (cached) return cached.data
      throw err
    }
  }

  private async request<T>(path: string, attempt = 0): Promise<T> {
    let response: globalThis.Response
    try {
      response = await fetch(`${IBGE_BASE_URL}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      // erro de rede ou timeout -- 1 retry com backoff, nunca mais que isso (§ mesmo
      // padrão de tmdb.provider.ts)
      if (attempt === 0) return this.retryAfterBackoff<T>(path, attempt)
      throw new LocationsUnavailableError()
    }

    if (response.ok) return (await response.json()) as T

    // 5xx do IBGE -- 1 retry com backoff; qualquer outro status não tenta de novo
    if (response.status >= 500 && attempt === 0) return this.retryAfterBackoff<T>(path, attempt)

    throw new LocationsUnavailableError()
  }

  private async retryAfterBackoff<T>(path: string, attempt: number): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS))
    return this.request<T>(path, attempt + 1)
  }
}
