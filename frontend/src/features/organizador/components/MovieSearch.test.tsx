import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import type { CatalogItem } from '../api'
import { MovieSearch } from './MovieSearch'

const API = env.VITE_API_URL

function emptySearchResponse() {
  return HttpResponse.json({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  })
}

function renderMovieSearch(onSelect: (item: CatalogItem | null) => void = vi.fn()) {
  return renderWithProviders(<MovieSearch selected={null} onSelect={onSelect} />)
}

afterEach(() => {
  queryClient.clear()
})

describe('MovieSearch', () => {
  it('digitar rápido dispara uma única busca (debounce de 400ms), não uma por tecla', async () => {
    let callCount = 0
    server.use(
      http.get(`${API}/catalog/search`, () => {
        callCount++
        return emptySearchResponse()
      }),
    )
    const user = userEvent.setup()
    renderMovieSearch()

    await user.type(screen.getByLabelText('Buscar filme'), 'duna')

    await waitFor(() => expect(callCount).toBe(1), { timeout: 1000 })
  })

  it('menos de 2 caracteres não dispara nenhuma requisição', async () => {
    let callCount = 0
    server.use(
      http.get(`${API}/catalog/search`, () => {
        callCount++
        return emptySearchResponse()
      }),
    )
    const user = userEvent.setup()
    renderMovieSearch()

    await user.type(screen.getByLabelText('Buscar filme'), 'd')
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(callCount).toBe(0)
  })

  it('estado vazio -- nenhum filme encontrado, com sugestão de refinar', async () => {
    server.use(http.get(`${API}/catalog/search`, () => emptySearchResponse()))
    const user = userEvent.setup()
    renderMovieSearch()

    await user.type(screen.getByLabelText('Buscar filme'), 'inexistente')

    expect(await screen.findByText('Nenhum filme encontrado para "inexistente"')).toBeInTheDocument()
  })

  it('CATALOG_UNAVAILABLE tratado -- mensagem amigável, sem "continuar sem catálogo"', async () => {
    server.use(
      http.get(`${API}/catalog/search`, () =>
        HttpResponse.json({ code: 'CATALOG_UNAVAILABLE', message: 'fora do ar' }, { status: 503 }),
      ),
    )
    const user = userEvent.setup()
    renderMovieSearch()

    await user.type(screen.getByLabelText('Buscar filme'), 'duna')

    // 503 aciona 1 retry (query-client.ts, "5xx vale tentar de novo") antes do erro
    // aparecer -- timeout maior que o findBy* default de 1s para dar tempo ao retry
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Catálogo temporariamente indisponível',
    )
    expect(screen.queryByRole('button', { name: /continuar sem catálogo/i })).not.toBeInTheDocument()
  })

  it('CATALOG_RATE_LIMITED recebe a mesma mensagem tratada de CATALOG_UNAVAILABLE', async () => {
    server.use(
      http.get(`${API}/catalog/search`, () =>
        HttpResponse.json({ code: 'CATALOG_RATE_LIMITED', message: 'limite excedido' }, { status: 503 }),
      ),
    )
    const user = userEvent.setup()
    renderMovieSearch()

    await user.type(screen.getByLabelText('Buscar filme'), 'duna')

    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Catálogo temporariamente indisponível',
    )
  })

  it('selecionar um resultado chama onSelect com o item completo', async () => {
    server.use(
      http.get(`${API}/catalog/search`, () =>
        HttpResponse.json({
          data: [{ source: 'TMDB', externalId: '1', title: 'Duna', subtitle: '2021', genres: [] }],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
        }),
      ),
    )
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderMovieSearch(onSelect)

    await user.type(screen.getByLabelText('Buscar filme'), 'duna')
    const resultButton = await screen.findByRole('button', { name: /Duna/ })
    await user.click(resultButton)

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'TMDB', externalId: '1', title: 'Duna' }),
    )
  })
})
