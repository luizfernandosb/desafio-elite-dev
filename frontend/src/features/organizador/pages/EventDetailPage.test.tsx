import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import type { OrganizerEvent, EventSeatmap } from '../api'
import EventDetailPage from './EventDetailPage'
import OrganizadorListPage from './OrganizadorListPage'

const API = env.VITE_API_URL

function makeEvent(overrides: Partial<OrganizerEvent> = {}): OrganizerEvent {
  return {
    id: 'evt-99',
    organizerId: 'org-1',
    source: 'TMDB',
    externalId: '1',
    title: 'Duna',
    genres: [],
    venueName: 'Cinemark Shopping',
    venueCity: 'São Paulo',
    venueState: 'SP',
    customImageKey: 'events/evt-99/capa.png',
    imageUrl: 'https://storage.example/evt-99/capa.png',
    type: 'SEATED',
    status: 'DRAFT',
    startsAt: '2026-09-20T23:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    currency: 'BRL',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    organizer: { id: 'org-1', name: 'Organizador' },
    _count: { tickets: 0 },
    ...overrides,
  }
}

const SEATMAP: EventSeatmap = {
  eventId: 'evt-99',
  rows: [],
  meta: { generatedAt: '2026-08-01T00:00:00.000Z', priceInCents: 3200, currency: 'BRL' },
}

function renderPage(event: OrganizerEvent) {
  server.use(
    http.get(`${API}/events/evt-99`, () => HttpResponse.json(event)),
    http.get(`${API}/events/evt-99/seatmap`, () => HttpResponse.json(SEATMAP)),
  )
  return renderWithProviders(
    <Routes>
      <Route path="/organizador/eventos/:id" element={<EventDetailPage />} />
      <Route path="/organizador" element={<OrganizadorListPage />} />
    </Routes>,
    { initialEntries: ['/organizador/eventos/evt-99'] },
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('EventDetailPage -- remover capa', () => {
  it('sucesso -- toast e capa volta a usar o pôster do catálogo', async () => {
    server.use(
      http.delete(`${API}/events/evt-99/image`, () =>
        HttpResponse.json(makeEvent({ customImageKey: null, imageUrl: 'https://tmdb.example/poster.jpg' })),
      ),
    )
    const user = userEvent.setup()
    renderPage(makeEvent())

    await user.click(await screen.findByRole('button', { name: 'Remover capa' }))

    expect(await screen.findByText('Capa removida - pôster do catálogo restaurado.')).toBeInTheDocument()
  })

  it('falha -- mostra erro inline, não fica em silêncio (antes desta correção, `removeMutation` não tinha `onError`)', async () => {
    server.use(
      http.delete(`${API}/events/evt-99/image`, () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'Acesso negado' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderPage(makeEvent())

    const removeButton = await screen.findByRole('button', { name: 'Remover capa' })
    await user.click(removeButton)

    await waitFor(() => expect(removeButton).toBeEnabled())
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado')
  })
})

describe('EventDetailPage -- cancelar sessão', () => {
  it('sucesso -- toast e navega para Minhas Sessões já na aba Publicadas', async () => {
    server.use(
      http.post(`${API}/events/evt-99/cancel`, () => HttpResponse.json(makeEvent({ status: 'CANCELLED' }))),
    )
    const user = userEvent.setup()
    renderPage(makeEvent())

    await user.click(await screen.findByRole('button', { name: 'Cancelar sessão' }))
    await user.type(screen.getByLabelText(/Digite .* para confirmar/), 'Duna')
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))

    expect(await screen.findByText('Sessão cancelada.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Minhas sessões' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Publicadas' })).toHaveAttribute('aria-selected', 'true')
  })
})
