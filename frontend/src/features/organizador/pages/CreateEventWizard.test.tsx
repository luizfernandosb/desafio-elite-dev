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

function futureDateParts2() {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 31)
  return { date: future.toISOString().slice(0, 10), time: '21:30' }
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

// mesmo que `fillVenueStepAndAdvance`, mas adiciona um segundo horário antes de
// avançar -- usado pelos testes de criação em lote
async function fillVenueStepWithTwoSlotsAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  const first = futureDateParts()
  const second = futureDateParts2()
  await user.type(await screen.findByLabelText('Local'), 'Cinemark Shopping')

  await user.click(screen.getByLabelText('Estado'))
  await user.click(await screen.findByRole('option', { name: 'São Paulo' }))

  await waitFor(() => expect(screen.getByLabelText('Cidade')).toBeEnabled())
  await user.click(screen.getByLabelText('Cidade'))
  await user.click(await screen.findByRole('option', { name: 'São Paulo' }))

  fireEvent.change(screen.getByLabelText('Data'), { target: { value: first.date } })
  fireEvent.change(screen.getByLabelText('Horário'), { target: { value: first.time } })

  await user.click(screen.getByRole('button', { name: 'Adicionar outro horário' }))
  const dateInputs = screen.getAllByLabelText('Data')
  const timeInputs = screen.getAllByLabelText('Horário')
  fireEvent.change(dateInputs[1]!, { target: { value: second.date } })
  fireEvent.change(timeInputs[1]!, { target: { value: second.time } })

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
      await user.click(screen.getByRole('button', { name: 'Publicar sessão' }))

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
      await user.click(screen.getByRole('button', { name: 'Publicar sessão' }))

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

  it(
    'dois horários -- cria e publica uma sessão por horário numa única submissão',
    async () => {
      const receivedBodies: Record<string, unknown>[] = []
      server.use(
        http.post(`${API}/events`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          receivedBodies.push(body)
          return HttpResponse.json({ id: `evt-${receivedBodies.length}` }, { status: 201 })
        }),
      )
      const user = userEvent.setup()
      renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepWithTwoSlotsAndAdvance(user)

      await user.type(await screen.findByLabelText('Fileiras'), '8')
      await user.type(screen.getByLabelText('Assentos por fileira'), '12')
      await user.type(screen.getByLabelText('Preço (R$)'), '32')
      await user.click(screen.getByRole('button', { name: 'Publicar 2 sessões' }))

      await waitFor(() => expect(receivedBodies).toHaveLength(2))
      expect(receivedBodies[0]).toMatchObject({ format: 'TWO_D', audio: 'DUBBED', roomType: 'STANDARD' })
      expect(receivedBodies[0]?.startsAt).not.toBe(receivedBodies[1]?.startsAt)

      // nada de "rascunho" -- as duas sessões do lote já nascem publicadas, sem
      // precisar abrir "Minhas sessões" pra publicar uma de cada vez
      expect(await screen.findByText('2 sessões publicadas.')).toBeInTheDocument()
    },
    WIZARD_TEST_TIMEOUT,
  )

  it(
    'dois horários, um falha ao criar -- mantém só o horário que falhou, não recria o que já deu certo',
    async () => {
      let calls = 0
      server.use(
        http.post(`${API}/events`, async () => {
          calls += 1
          if (calls === 1) return HttpResponse.json({ id: 'evt-ok' }, { status: 201 })
          return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos' }, { status: 400 })
        }),
      )
      const user = userEvent.setup()
      renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepWithTwoSlotsAndAdvance(user)

      await user.type(await screen.findByLabelText('Fileiras'), '8')
      await user.type(screen.getByLabelText('Assentos por fileira'), '12')
      await user.type(screen.getByLabelText('Preço (R$)'), '32')
      await user.click(screen.getByRole('button', { name: 'Publicar 2 sessões' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('1 de 2 sessões publicadas')
      expect(screen.getByRole('alert')).toHaveTextContent('1 não foi criada')
      // ainda no passo 3 (não navegou) -- e o botão agora reflete só 1 horário
      // restante (o que falhou ao criar), prova que o rascunho foi cortado para não
      // duplicar a sessão que já foi criada e publicada
      expect(await screen.findByRole('button', { name: 'Publicar sessão' })).toBeInTheDocument()
    },
    WIZARD_TEST_TIMEOUT,
  )

  it(
    'horário criado mas não publicado -- nunca recria (evita sessão duplicada), vira rascunho pra publicar manualmente',
    async () => {
      let createCalls = 0
      server.use(
        http.post(`${API}/events`, async () => {
          createCalls += 1
          if (createCalls === 1) return HttpResponse.json({ id: 'evt-a' }, { status: 201 })
          return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos' }, { status: 400 })
        }),
        http.post(`${API}/events/:id/publish`, () =>
          HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'Falha ao publicar' }, { status: 500 }),
        ),
      )
      const user = userEvent.setup()
      renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepWithTwoSlotsAndAdvance(user)

      await user.type(await screen.findByLabelText('Fileiras'), '8')
      await user.type(screen.getByLabelText('Assentos por fileira'), '12')
      await user.type(screen.getByLabelText('Preço (R$)'), '32')
      await user.click(screen.getByRole('button', { name: 'Publicar 2 sessões' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Não foi possível publicar as sessões.')
      expect(alert).toHaveTextContent('1 não foi criada')
      expect(alert).toHaveTextContent('1 foi criada, mas não publicada')
      expect(alert).toHaveTextContent('publique manualmente em "Minhas sessões"')

      // só o horário que sequer chegou a existir no servidor continua no
      // formulário -- o que foi criado (mas não publicado) NUNCA volta a ser
      // tentado de novo, senão um novo clique criaria uma segunda sessão duplicada
      // pro mesmo horário
      expect(await screen.findByRole('button', { name: 'Publicar sessão' })).toBeInTheDocument()
    },
    WIZARD_TEST_TIMEOUT,
  )

  it(
    'formato/áudio/sala são por horário -- só o horário marcado VIP mostra o campo de porcentagem',
    async () => {
      const receivedBodies: Record<string, unknown>[] = []
      server.use(
        http.post(`${API}/events`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          receivedBodies.push(body)
          return HttpResponse.json({ id: `evt-${receivedBodies.length}` }, { status: 201 })
        }),
      )
      const user = userEvent.setup()
      renderWizard()

      await selectMovieAndAdvance(user)
      await fillVenueStepWithTwoSlotsAndAdvance(user)

      await user.type(await screen.findByLabelText('Fileiras'), '8')
      await user.type(screen.getByLabelText('Assentos por fileira'), '12')
      await user.type(screen.getByLabelText('Preço (R$)'), '32')

      // nenhum horário é VIP ainda -- campo de porcentagem não existe
      expect(screen.queryByLabelText(/Porcentagem adicional da Sala VIP/)).not.toBeInTheDocument()

      // segundo horário vira 3D + Sala VIP; o primeiro continua 2D/Padrão
      const formatSelects = screen.getAllByLabelText('Formato')
      await user.click(formatSelects[1]!)
      await user.click(await screen.findByRole('option', { name: '3D' }))

      const roomTypeSelects = screen.getAllByLabelText('Sala')
      await user.click(roomTypeSelects[1]!)
      await user.click(await screen.findByRole('option', { name: 'VIP' }))

      // só UM campo de porcentagem aparece -- o do horário marcado VIP, não os dois
      const vipInputs = await screen.findAllByLabelText(/Porcentagem adicional da Sala VIP/)
      expect(vipInputs).toHaveLength(1)
      await user.type(vipInputs[0]!, '20')

      await user.click(screen.getByRole('button', { name: 'Publicar 2 sessões' }))

      await waitFor(() => expect(receivedBodies).toHaveLength(2))
      expect(receivedBodies[0]).toMatchObject({
        format: 'TWO_D',
        audio: 'DUBBED',
        roomType: 'STANDARD',
      })
      expect(receivedBodies[0]).not.toHaveProperty('vipSurchargePercent')
      expect(receivedBodies[1]).toMatchObject({
        format: 'THREE_D',
        audio: 'DUBBED',
        roomType: 'VIP',
        vipSurchargePercent: 20,
      })
    },
    WIZARD_TEST_TIMEOUT,
  )
})
