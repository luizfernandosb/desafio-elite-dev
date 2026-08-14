import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { makeAuth, renderWithProviders } from '../../../test/render'
import type { AuthContextValue } from '../../auth/useAuth'
import EventDetailPage from './EventDetailPage'

const API = env.VITE_API_URL

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    source: 'TMDB',
    externalId: '693134',
    title: 'Duna: Parte Dois',
    synopsis: 'Sinopse.',
    genres: ['Ficção científica'],
    runtimeMinutes: 166,
    venueName: 'Cine Elite',
    venueCity: 'Manaus',
    format: 'TWO_D',
    audio: 'DUBBED',
    roomType: 'STANDARD',
    status: 'PUBLISHED',
    startsAt: '2026-09-20T23:00:00.000Z', // 19:00 em Manaus (UTC-4, sem horário de verão)
    timezone: 'America/Manaus',
    priceInCents: 3200,
    effectivePriceInCents: 3200,
    currency: 'BRL',
    organizer: { id: 'org-1', name: 'Ana' },
    _count: { tickets: 2 },
    ...overrides,
  }
}

// `GET /events` (sem id) é a lista de OUTRAS sessões do mesmo filme
// (ShowtimePicker) -- o back nunca devolve DRAFT/CANCELLED nem sessão passada por
// conta própria (o passado é filtrado no cliente, ver `showtimes.ts`), então o mock
// aqui só precisa devolver exatamente o que o cenário do teste representa.
function mockEventsList(sessions: ReturnType<typeof makeEvent>[]) {
  server.use(
    http.get(`${API}/events`, () =>
      HttpResponse.json({
        data: sessions,
        meta: { page: 1, limit: 100, total: sessions.length, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    ),
  )
}

function emptySeatmap() {
  return HttpResponse.json({
    eventId: 'evt-1',
    rows: [],
    meta: { generatedAt: '2026-08-01T00:00:00.000Z', priceInCents: 3200, currency: 'BRL' },
  })
}

function renderDetail(auth: AuthContextValue, id = 'evt-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/eventos/:id" element={<EventDetailPage />} />
    </Routes>,
    { initialEntries: [`/eventos/${id}`], auth },
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('EventDetailPage', () => {
  // O componente precisa formatar o horário no fuso IANA do EVENTO
  // (`event.timezone`), nunca no fuso de quem roda o processo (§4.6.3) -- não dá
  // para fixar `process.env.TZ` neste arquivo (tsconfig.app.json não tem tipos de
  // Node, e não deveria ganhar -- só para um teste). Em vez disso, o teste escolhe
  // dois fusos com offsets bem diferentes (Manaus e São Paulo, ambos sem horário de
  // verão) e verifica que o texto renderizado muda de acordo com `event.timezone`,
  // nunca com o relógio da máquina que roda a suíte -- mesmo raciocínio de
  // `shared/date.test.ts`, aplicado aqui à tela de verdade.
  it('mostra o horário no fuso do EVENTO (Manaus), não em outro fuso qualquer', async () => {
    const event = makeEvent()
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(event)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([event])
    renderDetail(makeAuth())

    // 23:00 UTC em Manaus (UTC-4, sem horário de verão) é 19:00 -- em São Paulo
    // (UTC-3) seria 20:00; nenhuma das duas pode aparecer no lugar da outra
    expect(await screen.findByText('19:00')).toBeInTheDocument()
    expect(screen.queryByText('20:00')).not.toBeInTheDocument()
  })

  it('sem login, escolher um horário leva para /entrar com ?redirect= de volta ao mapa de assentos', async () => {
    const event = makeEvent()
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(event)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([event])
    renderDetail(makeAuth({ status: 'anonymous' }))

    const cta = await screen.findByRole('link', { name: /Escolher assentos/ })
    expect(cta).toHaveAttribute('href', '/entrar?redirect=%2Feventos%2Fevt-1%2Fassentos')
  })

  it('autenticado, escolher um horário leva direto ao mapa de assentos, sem passar por /entrar', async () => {
    const event = makeEvent()
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(event)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([event])
    renderDetail(
      makeAuth({
        status: 'authenticated',
        user: { id: 'u1', name: 'Bruno', email: 'bruno@exemplo.com', role: 'CUSTOMER' },
      }),
    )

    const cta = await screen.findByRole('link', { name: /Escolher assentos/ })
    expect(cta).toHaveAttribute('href', '/eventos/evt-1/assentos')
  })

  it('sessão cancelada -- banner de aviso, sem quebrar a busca por outras sessões do filme', async () => {
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(makeEvent({ status: 'CANCELLED' }))),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    // o back nunca lista CANCELLED pro público (events.service.ts, status=PUBLISHED
    // por padrão) -- lista de outras sessões vazia é o cenário real
    mockEventsList([])
    renderDetail(makeAuth())

    expect(await screen.findByText('A sessão que você abriu foi cancelada.')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma sessão neste dia.')).toBeInTheDocument()
  })

  it('sessão já ocorrida -- aviso, e ela mesma some da lista de horários (já passou)', async () => {
    const pastEvent = makeEvent({ startsAt: '2020-01-01T12:00:00.000Z' })
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(pastEvent)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([pastEvent])
    renderDetail(makeAuth())

    expect(await screen.findByText('A sessão que você abriu já ocorreu.')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma sessão neste dia.')).toBeInTheDocument()
  })

  it('duas sessões do mesmo filme em dias diferentes -- trocar de aba mostra a outra', async () => {
    const day1 = makeEvent({ id: 'evt-1', startsAt: '2026-09-20T23:00:00.000Z' }) // 19:00 Manaus
    const day2 = makeEvent({ id: 'evt-2', startsAt: '2026-09-21T22:00:00.000Z' }) // 18:00 Manaus
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(day1)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([day1, day2])
    const user = userEvent.setup()
    renderDetail(makeAuth())

    expect(await screen.findByText('19:00')).toBeInTheDocument()
    expect(screen.queryByText('18:00')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /21\/09/ }))

    expect(await screen.findByText('18:00')).toBeInTheDocument()
    expect(screen.queryByText('19:00')).not.toBeInTheDocument()
  })

  it('duas sessões no mesmo dia com áudio diferente -- dois grupos separados ("Dublado - 2D" / "Legendado - 2D")', async () => {
    const dubbed = makeEvent({ id: 'evt-1', audio: 'DUBBED' })
    const subtitled = makeEvent({ id: 'evt-2', audio: 'SUBTITLED', startsAt: '2026-09-20T22:00:00.000Z' })
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(dubbed)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([dubbed, subtitled])
    renderDetail(makeAuth())

    expect(await screen.findByText('Dublado - 2D')).toBeInTheDocument()
    expect(await screen.findByText('Legendado - 2D')).toBeInTheDocument()
  })

  it('preço "a partir de" reflete o menor entre todos os horários, não só o da sessão aberta', async () => {
    const expensive = makeEvent({ id: 'evt-1', effectivePriceInCents: 5000 })
    const cheaper = makeEvent({ id: 'evt-2', effectivePriceInCents: 3000, startsAt: '2026-09-20T22:00:00.000Z' })
    server.use(
      http.get(`${API}/events/evt-1`, () => HttpResponse.json(expensive)),
      http.get(`${API}/events/evt-1/seatmap`, () => emptySeatmap()),
    )
    mockEventsList([expensive, cheaper])
    renderDetail(makeAuth())

    expect(
      await screen.findByText((_, element) => element?.textContent === 'A partir de R$ 30,00'),
    ).toBeInTheDocument()
  })
})
