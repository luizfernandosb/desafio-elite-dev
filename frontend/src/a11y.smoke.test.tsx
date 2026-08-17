import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { SeatMap, type SeatMapRow } from './components/SeatMap'
import { env } from './lib/env'
import { queryClient } from './lib/query-client'
import { server } from './test/msw/server'
import { renderWithProviders } from './test/render'
import { EventList } from './features/catalog/components/EventList'
import { ValidationResultScreen } from './features/gate/components/ValidationResultScreen'
import type { GateValidationResponse } from './features/gate/api'
import TicketListPage from './features/tickets/pages/TicketListPage'

const API = env.VITE_API_URL

function criticalViolations(results: Awaited<ReturnType<typeof axe>>) {
  return results.violations
    .filter((violation) => violation.impact === 'critical')
    .map((violation) => ({ id: violation.id, help: violation.help, nodes: violation.nodes.map((n) => n.target) }))
}

afterEach(() => {
  queryClient.clear()
})

describe('a11y smoke -- axe-core, zero violação crítica (§ etapa 12)', () => {
  it('SeatMap -- livre, reservado, selecionado, vendido, acessível', async () => {
    const rows: SeatMapRow[] = [
      {
        row: 'A',
        seats: [
          { label: 'A1', status: 'FREE' },
          { label: 'A2', status: 'HELD' },
          { label: 'A3', status: 'FREE', selected: true },
          { label: 'A4', status: 'SOLD' },
          { label: 'A5', status: 'FREE', accessible: true },
        ],
      },
    ]
    const { container } = render(
      <SeatMap rows={rows} onSeatClick={() => {}} legend ariaLabel="Mapa de assentos -- Sala 1" />,
    )

    const results = await axe(container)
    expect(criticalViolations(results)).toEqual([])
  })

  it.each([
    ['VALID', 'Entrada liberada'],
    ['ALREADY_USED', 'Ingresso já utilizado'],
    ['WRONG_EVENT', 'Ingresso de outro evento'],
    ['INVALID_SIGNATURE', 'Código inválido'],
  ] as const)('ValidationResultScreen -- %s', async (result, message) => {
    const response: GateValidationResponse = {
      result,
      message,
      ticket: result === 'VALID' || result === 'ALREADY_USED' ? { seat: 'A12', eventTitle: 'Sessão' } : null,
      usedAt: result === 'ALREADY_USED' ? new Date().toISOString() : null,
      validatedBy: result === 'ALREADY_USED' ? 'Ana' : null,
    }
    const { container } = render(<ValidationResultScreen response={response} muted onDismiss={() => {}} />)

    const results = await axe(container)
    expect(criticalViolations(results)).toEqual([])
  })

  it('TicketListPage -- com dados (skeleton já resolvido)', async () => {
    server.use(
      http.get(`${API}/tickets`, () =>
        HttpResponse.json({
          data: [
            {
              id: 't1',
              status: 'ACTIVE',
              usedAt: null,
              createdAt: new Date().toISOString(),
              event: {
                id: 'evt-1',
                title: 'Duna: Parte Dois',
                imageUrl: null,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                endsAt: null,
                timezone: 'America/Sao_Paulo',
                venueName: 'Cine Elite',
                venueCity: 'São Paulo',
              },
              seat: { row: 'A', number: 12 },
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
        }),
      ),
    )

    const { container, findByText } = renderWithProviders(
      <Routes>
        <Route path="/ingressos" element={<TicketListPage />} />
      </Routes>,
      { initialEntries: ['/ingressos'] },
    )

    await findByText('Duna: Parte Dois')
    const results = await axe(container)
    expect(criticalViolations(results)).toEqual([])
  })

  it('EventList -- sem resultado para o filtro, com ação de limpar', async () => {
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        }),
      ),
    )

    const { container, findByText } = renderWithProviders(
      <EventList q="inexistente" from="" to="" page={1} onPageChange={() => {}} onClearFilters={() => {}} />,
    )

    await findByText('Nenhum resultado para "inexistente"')
    const results = await axe(container)
    expect(criticalViolations(results)).toEqual([])
  })

  it('EventList -- com resultados', async () => {
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'evt-1',
              source: 'TMDB',
              externalId: '693134',
              title: 'Duna: Parte Dois',
              genres: ['Ficção científica'],
              imageUrl: 'https://image.tmdb.org/duna.jpg',
              venueName: 'Cine Elite',
              venueCity: 'São Paulo',
              format: 'TWO_D',
              audio: 'DUBBED',
              roomType: 'STANDARD',
              status: 'PUBLISHED',
              startsAt: new Date(Date.now() + 86_400_000).toISOString(),
              timezone: 'America/Sao_Paulo',
              priceInCents: 3200,
              effectivePriceInCents: 3200,
              currency: 'BRL',
              organizer: { id: 'org-1', name: 'Ana' },
              _count: { tickets: 0 },
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
        }),
      ),
    )

    const { container, findByRole } = renderWithProviders(
      <EventList q="" from="" to="" page={1} onPageChange={() => {}} onClearFilters={() => {}} />,
    )

    await findByRole('heading', { level: 3, name: 'Duna: Parte Dois' })
    const results = await axe(container)
    expect(criticalViolations(results)).toEqual([])
  })
})
