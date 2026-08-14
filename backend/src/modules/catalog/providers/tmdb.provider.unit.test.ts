import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { NotFoundError } from '../../../shared/errors'
import { server } from '../../../test/msw/server'
import { CatalogRateLimitedError, CatalogUnavailableError } from '../catalog.types'
import { TmdbProvider } from './tmdb.provider'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('TmdbProvider.search', () => {
  it('normaliza resultados com imageUrl absoluta e gêneros resolvidos por nome', async () => {
    const provider = new TmdbProvider()
    const result = await provider.search('matrix', 1)

    expect(result.total).toBe(1)
    expect(result.items).toEqual([
      {
        source: 'TMDB',
        externalId: '603',
        title: 'The Matrix',
        synopsis: 'Um hacker descobre a verdade sobre a sua realidade.',
        imageUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
        genres: ['Ação', 'Ficção científica'],
      },
    ])
  })

  it('poster_path nulo não quebra e não gera imageUrl', async () => {
    server.use(
      http.get('https://api.themoviedb.org/3/search/movie', () =>
        HttpResponse.json({
          results: [{ id: 1, title: 'Sem pôster', overview: null, poster_path: null, genre_ids: [] }],
          total_results: 1,
        }),
      ),
    )

    const provider = new TmdbProvider()
    const result = await provider.search('sem poster', 1)

    expect(result.items[0]?.imageUrl).toBeUndefined()
    expect(result.items[0]?.synopsis).toBeUndefined()
  })

  it('mapeia 429 do TMDb para CatalogRateLimitedError, sem retry', async () => {
    let calls = 0
    server.use(
      http.get('https://api.themoviedb.org/3/search/movie', () => {
        calls += 1
        return HttpResponse.json({ status_message: 'rate limited' }, { status: 429 })
      }),
    )

    const provider = new TmdbProvider()
    await expect(provider.search('qualquer', 1)).rejects.toThrow(CatalogRateLimitedError)
    expect(calls).toBe(1)
  })

  it('erro de rede tenta 1 vez mais e, se persistir, vira CatalogUnavailableError 503', async () => {
    let calls = 0
    server.use(
      http.get('https://api.themoviedb.org/3/search/movie', () => {
        calls += 1
        return HttpResponse.error()
      }),
    )

    const provider = new TmdbProvider()
    const promise = provider.search('qualquer', 1)
    await expect(promise).rejects.toThrow(CatalogUnavailableError)
    await expect(promise).rejects.toMatchObject({ statusHint: 503 })
    expect(calls).toBe(2) // 1 tentativa + 1 retry
  })

  it('401/403 do TMDb vira CatalogUnavailableError 500 -- é chave errada, problema nosso', async () => {
    server.use(
      http.get('https://api.themoviedb.org/3/search/movie', () =>
        HttpResponse.json({ status_message: 'invalid key' }, { status: 401 }),
      ),
    )

    const provider = new TmdbProvider()
    await expect(provider.search('qualquer', 1)).rejects.toMatchObject({
      statusHint: 500,
      code: 'CATALOG_UNAVAILABLE',
    })
  })

  it('genre_ids sem correspondência no mapa de gêneros são descartados, não quebram', async () => {
    server.use(
      http.get('https://api.themoviedb.org/3/search/movie', () =>
        HttpResponse.json({
          results: [{ id: 2, title: 'Gênero desconhecido', overview: '', poster_path: null, genre_ids: [999999] }],
          total_results: 1,
        }),
      ),
    )

    const provider = new TmdbProvider()
    const result = await provider.search('qualquer', 1)
    expect(result.items[0]?.genres).toEqual([])
  })
})

describe('TmdbProvider.getById', () => {
  it('normaliza o detalhe com subtitle (tagline), runtimeMinutes e classificação BR', async () => {
    const provider = new TmdbProvider()
    const item = await provider.getById('603')

    expect(item).toEqual({
      source: 'TMDB',
      externalId: '603',
      title: 'The Matrix',
      subtitle: 'Bem-vindo ao mundo real.',
      synopsis: 'Um hacker descobre a verdade sobre a sua realidade.',
      imageUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
      runtimeMinutes: 136,
      genres: ['Ação', 'Ficção científica'],
      ageRating: '14',
    })
  })

  it('404 do TMDb vira NotFoundError', async () => {
    const provider = new TmdbProvider()
    await expect(provider.getById('id-inexistente')).rejects.toThrow(NotFoundError)
  })

  it('sem entrada BR em release_dates -- ageRating undefined, não lança erro', async () => {
    server.use(
      http.get('https://api.themoviedb.org/3/movie/:id/release_dates', () =>
        HttpResponse.json({ id: 603, results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'R' }] }] }),
      ),
    )

    const provider = new TmdbProvider()
    const item = await provider.getById('603')

    expect(item.ageRating).toBeUndefined()
  })

  it('release_dates indisponível (erro de rede) -- detalhe do filme ainda é devolvido, só sem classificação', async () => {
    server.use(
      http.get('https://api.themoviedb.org/3/movie/:id/release_dates', () => HttpResponse.error()),
    )

    const provider = new TmdbProvider()
    const item = await provider.getById('603')

    expect(item.ageRating).toBeUndefined()
    expect(item.title).toBe('The Matrix')
  })
})
