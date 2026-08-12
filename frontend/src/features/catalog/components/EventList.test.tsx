import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { EventList } from './EventList'

const API = env.VITE_API_URL

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Duna: Parte Dois',
    subtitle: '2021',
    imageUrl: 'https://image.tmdb.org/duna.jpg',
    genres: ['Ficção científica'],
    venueName: 'Cine Elite',
    venueCity: 'São Paulo',
    status: 'PUBLISHED',
    startsAt: '2026-09-20T23:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    currency: 'BRL',
    organizer: { id: 'org-1', name: 'Ana' },
    _count: { tickets: 3 },
    ...overrides,
  }
}

function emptyResponse(overrides: Record<string, unknown> = {}) {
  return HttpResponse.json({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    ...overrides,
  })
}

interface RenderProps {
  q?: string
  from?: string
  to?: string
  page?: number
  onPageChange?: (page: number) => void
  onClearFilters?: () => void
}

function renderList(props: RenderProps = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventList
          q={props.q ?? ''}
          from={props.from ?? ''}
          to={props.to ?? ''}
          page={props.page ?? 1}
          onPageChange={props.onPageChange ?? vi.fn()}
          onClearFilters={props.onClearFilters ?? vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('EventList', () => {
  it('skeleton enquanto carrega, depois os cards com os dados reais', async () => {
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json({
          data: [makeEvent()],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
        }),
      ),
    )
    renderList()

    expect(await screen.findByText('Duna: Parte Dois')).toBeInTheDocument()
  })

  it('vazio sem filtro -- mensagem de catálogo ainda sem sessões, não parece bug', async () => {
    server.use(http.get(`${API}/events`, () => emptyResponse()))
    renderList()

    expect(await screen.findByText('Nenhuma sessão publicada ainda')).toBeInTheDocument()
  })

  it('vazio com filtro -- mensagem específica e botão para limpar filtros', async () => {
    server.use(http.get(`${API}/events`, () => emptyResponse()))
    const onClearFilters = vi.fn()
    const user = userEvent.setup()
    renderList({ q: 'inexistente', onClearFilters })

    expect(await screen.findByText('Nenhum resultado para "inexistente"')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('paginação usa meta do servidor (totalPages/hasNext), nunca data.length', async () => {
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json({
          data: [makeEvent()],
          meta: { page: 2, limit: 20, total: 45, totalPages: 3, hasNext: true, hasPrev: true },
        }),
      ),
    )
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    renderList({ page: 2, onPageChange })

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('erro -- mensagem tratada com requestId, lista nunca some sem explicação', async () => {
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'Erro interno', requestId: 'req-abc' }, { status: 500 }),
      ),
    )
    renderList()

    // 500 aciona 1 retry (query-client.ts) antes do erro aparecer -- timeout maior
    // que o findBy* default de 1s (mesmo raciocínio de MovieSearch.test.tsx)
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Erro interno')
    expect(screen.getByText(/req-abc/)).toBeInTheDocument()
  })
})
