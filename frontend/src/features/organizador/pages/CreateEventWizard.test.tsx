import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import CreateEventWizard from './CreateEventWizard'

const API = env.VITE_API_URL
const DRAFT_KEY = 'organizador:novo-evento:rascunho'

// Três passos, cada um com digitação real via userEvent (sem fake timers) e um
// debounce de 400ms no passo 1 -- sob contenção de CPU (suíte inteira em paralelo)
// o tempo total pode passar dos 5s default do Vitest sem nada estar de fato travado
// (mesma causa da folga extra em MovieSearch.test.tsx para os casos com retry de 503).
const WIZARD_TEST_TIMEOUT = 15000

function renderWizard(initialEntries: string[] = ['/organizador/eventos/nova']) {
  return renderWithProviders(
    <Routes>
      <Route path="/organizador/eventos/nova" element={<CreateEventWizard />} />
      <Route path="/organizador/eventos/:id" element={<div data-testid="detail-page" />} />
    </Routes>,
    { initialEntries },
  )
}

function mockMovieSearch() {
  server.use(
    http.get(`${API}/catalog/search`, () =>
      HttpResponse.json({
        data: [{ source: 'TMDB', externalId: '1', title: 'Duna', subtitle: '2021', genres: [] }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    ),
  )
}

function futureDateParts() {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  return { date: future.toISOString().slice(0, 10), time: '20:00' }
}

async function selectMovieAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  mockMovieSearch()
  await user.type(screen.getByLabelText('Buscar filme'), 'duna')
  // timeout maior que o findBy* default de 1s: debounce de 400ms + resolução da
  // query sob a suíte inteira rodando em paralelo pode passar de 1s sem travar de
  // verdade (mesmo raciocínio do timeout de retry em MovieSearch.test.tsx)
  const resultButton = await screen.findByRole('button', { name: /Duna/ }, { timeout: 3000 })
  await user.click(resultButton)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
}

async function fillVenueStepAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  const { date, time } = futureDateParts()
  await user.type(await screen.findByLabelText('Local'), 'Cinemark Shopping')

  await user.click(screen.getByLabelText('Estado'))
  await user.click(await screen.findByRole('option', { name: 'São Paulo' }))

  await waitFor(() => expect(screen.getByLabelText('Cidade')).toBeEnabled())
  await user.click(screen.getByLabelText('Cidade'))
  await user.click(await screen.findByRole('option', { name: 'São Paulo' }))

  fireEvent.change(screen.getByLabelText('Data'), { target: { value: date } })
  fireEvent.change(screen.getByLabelText('Horário'), { target: { value: time } })
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  queryClient.clear()
})

describe('CreateEventWizard', () => {
  it(
    'passo 3 não envia com layout fora do limite (26 fileiras no máximo)',
    async () => {
      const user = userEvent.setup()
      renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepAndAdvance(user)

      await user.type(await screen.findByLabelText('Fileiras'), '99')
      await user.type(screen.getByLabelText('Assentos por fileira'), '10')
      await user.type(screen.getByLabelText('Preço (R$)'), '32')
      await user.click(screen.getByRole('button', { name: 'Criar sessão' }))

      expect(await screen.findByText('Máximo 26 fileiras')).toBeInTheDocument()
      expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument()
    },
    WIZARD_TEST_TIMEOUT,
  )

  it(
    'preço em reais é convertido para centavos no envio (R$ 32,00 -> 3200)',
    async () => {
      let receivedBody: Record<string, unknown> | null = null
      server.use(
        http.post(`${API}/events`, async ({ request }) => {
          receivedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ id: 'evt-1' }, { status: 201 })
        }),
      )
      const user = userEvent.setup()
      renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepAndAdvance(user)

      await user.type(await screen.findByLabelText('Fileiras'), '8')
      await user.type(screen.getByLabelText('Assentos por fileira'), '12')
      await user.type(screen.getByLabelText('Preço (R$)'), '32.00')
      await user.click(screen.getByRole('button', { name: 'Criar sessão' }))

      await waitFor(() => expect(receivedBody).not.toBeNull())
      expect(receivedBody).toMatchObject({
        priceInCents: 3200,
        layout: { rows: 8, seatsPerRow: 12 },
      })
      await screen.findByTestId('detail-page')
    },
    WIZARD_TEST_TIMEOUT,
  )

  it(
    'rascunho sobrevive a F5 -- filme e dados do passo 2 continuam disponíveis no passo 3',
    async () => {
      const user = userEvent.setup()
      const { unmount } = renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepAndAdvance(user)

      expect(sessionStorage.getItem(DRAFT_KEY)).toContain('"title":"Duna"')

      unmount() // simula F5: desmonta a árvore -- sessionStorage sobrevive normalmente

      renderWizard(['/organizador/eventos/nova?passo=3'])

      // chegou direto no passo 3 sem precisar re-selecionar o filme -- prova que o
      // rascunho (movie + venue/data/hora) foi restaurado do sessionStorage
      expect(await screen.findByLabelText('Fileiras')).toBeInTheDocument()
      expect(screen.getByText(/Duna/)).toBeInTheDocument()
    },
    WIZARD_TEST_TIMEOUT,
  )
})
