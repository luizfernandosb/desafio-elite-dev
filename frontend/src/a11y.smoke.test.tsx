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
import { ValidationResultScreen } from './features/gate/components/ValidationResultScreen'
import type { GateValidationResponse } from './features/gate/api'
import TicketListPage from './features/tickets/pages/TicketListPage'

const API = env.VITE_API_URL

// Zero violação CRÍTICA é o critério de aceite da etapa 12 -- "moderada" fica
// registrada e justificada, não trava o build. Fragmentos isolados (sem <html
// lang>, sem landmark de página) disparam ruído de nível "serious"/"moderate"
// (`html-has-lang`, `region`) que não é sobre o componente em si -- filtrar por
// `impact` em vez de usar o matcher pronto da lib evita esse falso positivo sem
// esconder o que de fato importa.
function criticalViolations(results: Awaited<ReturnType<typeof axe>>) {
  return results.violations
    .filter((violation) => violation.impact === 'critical')
    .map((violation) => ({ id: violation.id, help: violation.help, nodes: violation.nodes.map((n) => n.target) }))
}

afterEach(() => {
  queryClient.clear()
})

describe('a11y smoke -- axe-core, zero violação crítica (§ etapa 12)', () => {
  // risco nº 1 do plano: grid de assentos, os quatro estados + acessível juntos
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

  // risco nº 2 do plano: card de resultado da portaria em tela cheia, anunciado
  // via role="alert"/aria-live="assertive" -- os quatro tons (valid/invalid/used/
  // neutral, ver `status.ts`) num único smoke por representatividade
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

  // tela de lista comum (§ etapa 09/11) -- skeleton, conteúdo agrupado e paginação
  // juntos, representativa das outras listas retrofitadas na etapa 11
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
})
