import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import { GateStatsPanel } from './GateStats'

const API = env.VITE_API_URL

afterEach(() => {
  queryClient.clear()
})

describe('GateStatsPanel', () => {
  it('reflete o contador de GET /gate/events/:id/stats', async () => {
    server.use(
      http.get(`${API}/gate/events/evt-1/stats`, () =>
        HttpResponse.json({
          total: 200,
          used: 142,
          remaining: 58,
          lastValidations: [
            { result: 'VALID', createdAt: '2026-08-13T20:00:00.000Z', ticketId: 't1' },
            { result: 'ALREADY_USED', createdAt: '2026-08-13T20:01:00.000Z', ticketId: 't2' },
          ],
        }),
      ),
    )

    renderWithProviders(<GateStatsPanel eventId="evt-1" />)

    expect(await screen.findByText('142 de 200')).toBeInTheDocument()
    expect(screen.getByText(/58 restantes/)).toBeInTheDocument()
    expect(screen.getByLabelText('Últimas validações').children).toHaveLength(2)
  })

  it('sem validações ainda -- contador aparece, feed some sem quebrar o layout', async () => {
    server.use(
      http.get(`${API}/gate/events/evt-1/stats`, () =>
        HttpResponse.json({ total: 50, used: 0, remaining: 50, lastValidations: [] }),
      ),
    )

    renderWithProviders(<GateStatsPanel eventId="evt-1" />)

    expect(await screen.findByText('0 de 50')).toBeInTheDocument()
    expect(screen.queryByLabelText('Últimas validações')).not.toBeInTheDocument()
  })

  // § etapa 11, bugs.md -- antes desta etapa, uma falha aqui deixava o skeleton para
  // sempre (nem erro, nem conteúdo): `isLoading || !data` nunca virava falso depois
  // que a query esgotava os retries.
  it('erro -- ErrorState com retry, nunca skeleton para sempre', async () => {
    server.use(
      http.get(`${API}/gate/events/evt-1/stats`, () =>
        HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'Erro interno' }, { status: 500 }),
      ),
    )

    renderWithProviders(<GateStatsPanel eventId="evt-1" />)

    // 500 aciona 1 retry (query-client.ts) antes do erro aparecer
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Erro interno')
  })
})
