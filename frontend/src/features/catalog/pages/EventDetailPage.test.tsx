import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { AuthContext, type AuthContextValue } from '../../auth/useAuth'
import EventDetailPage from './EventDetailPage'

const API = env.VITE_API_URL

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    status: 'anonymous',
    login: async () => {},
    register: async () => {},
    loginWithGoogle: async () => {},
    logout: async () => {},
    ...overrides,
  }
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Duna: Parte Dois',
    synopsis: 'Sinopse.',
    genres: ['Ficção científica'],
    runtimeMinutes: 166,
    venueName: 'Cine Elite',
    venueCity: 'Manaus',
    status: 'PUBLISHED',
    startsAt: '2026-09-20T23:00:00.000Z', // 19:00 em Manaus (UTC-4, sem horário de verão)
    timezone: 'America/Manaus',
    priceInCents: 3200,
    currency: 'BRL',
    organizer: { id: 'org-1', name: 'Ana' },
    _count: { tickets: 2 },
    ...overrides,
  }
}

function emptySeatmap() {
  return HttpResponse.json({
    eventId: 'evt-1',
    rows: [],
    meta: { generatedAt: '2026-08-01T00:00:00.000Z', priceInCents: 3200, currency: 'BRL' },
  })
}

function renderDetail(auth: AuthContextValue, id = 'evt-1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[`/eventos/${id}`]}>
          <Routes>
            <Route path="/eventos/:id" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('EventDetailPage', () => {
  // O componente precisa formatar `startsAt` no fuso IANA do EVENTO
  // (`event.timezone`), nunca no fuso de quem roda o processo (§4.6.3) -- não dá
  // para fixar `process.env.TZ` neste arquivo (tsconfig.app.json não tem tipos de
  // Node, e não deveria ganhar -- só para um teste). Em vez disso, o teste escolhe
  // dois fusos com offsets bem diferentes (Manaus e São Paulo, ambos sem horário de
  // verão) e verifica que o texto renderizado muda de acordo com `event.timezone`,
  // nunca com o relógio da máquina que roda a suíte -- mesmo raciocínio de
  // `shared/date.test.ts`, aplicado aqui à tela de verdade.
  it('mostra a data no fuso do EVENTO (Manaus), não em outro fuso qualquer', async () => {
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent())),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    renderDetail(makeAuth())

    // 23:00 UTC em Manaus (UTC-4, sem horário de verão) é 19:00 -- em São Paulo
    // (UTC-3) seria 20:00; nenhuma das duas pode aparecer no lugar da outra
    expect(await screen.findByText(/19:00/)).toBeInTheDocument()
    expect(screen.queryByText(/20:00/)).not.toBeInTheDocument()
  })

  it('sem login, "Escolher assentos" leva para /entrar com ?redirect= de volta ao mapa de assentos', async () => {
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent())),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    renderDetail(makeAuth({ status: 'anonymous' }))

    const cta = await screen.findByRole('link', { name: 'Escolher assentos' })
    expect(cta).toHaveAttribute('href', '/entrar?redirect=%2Feventos%2Fevt-1%2Fassentos')
  })

  it('autenticado, "Escolher assentos" leva direto ao mapa de assentos, sem passar por /entrar', async () => {
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent())),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    renderDetail(
      makeAuth({
        status: 'authenticated',
        user: { id: 'u1', name: 'Bruno', email: 'bruno@exemplo.com', role: 'CUSTOMER' },
      }),
    )

    const cta = await screen.findByRole('link', { name: 'Escolher assentos' })
    expect(cta).toHaveAttribute('href', '/eventos/evt-1/assentos')
  })

  it('sessão cancelada -- CTA desabilitada com o motivo, sem link de navegação', async () => {
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent({ status: 'CANCELLED' }))),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    renderDetail(makeAuth())

    expect(await screen.findByText('Esta sessão foi cancelada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher assentos' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Escolher assentos' })).not.toBeInTheDocument()
  })

  it('sessão já ocorrida -- CTA desabilitada com o motivo', async () => {
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent({ startsAt: '2020-01-01T12:00:00.000Z' }))),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    renderDetail(makeAuth())

    expect(await screen.findByText('Esta sessão já ocorreu.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher assentos' })).toBeDisabled()
  })
})
