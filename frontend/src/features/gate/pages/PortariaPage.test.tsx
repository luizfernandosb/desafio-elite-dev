import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../components'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import PortariaPage from './PortariaPage'

const API = env.VITE_API_URL

// A câmera de verdade não roda em jsdom (sem `navigator.mediaDevices`) -- mockada
// para rejeitar na hora, então `GateScanner` só mostra o aviso de câmera
// indisponível e a digitação manual é o caminho exercitado neste teste de página.
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: vi.fn().mockImplementation(function FakeBrowserQRCodeReader() {
    return { decodeFromConstraints: vi.fn().mockRejectedValue(new Error('sem câmera em jsdom')) }
  }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Duna: Parte Dois',
    imageUrl: null,
    genres: [],
    venueName: 'Cine Elite',
    venueCity: 'São Paulo',
    status: 'PUBLISHED',
    startsAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    currency: 'BRL',
    organizer: { id: 'org-1', name: 'Ana' },
    _count: { tickets: 3 },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PortariaPage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
})

describe('PortariaPage', () => {
  it('sem sessão escolhida -- convite para selecionar, sem tentar validar nada', async () => {
    server.use(http.get(`${API}/events`, () => HttpResponse.json({ data: [makeEvent()], meta: {} })))

    renderPage()

    expect(
      await screen.findByText('Selecione a sessão deste posto para começar a validar ingressos.'),
    ).toBeInTheDocument()
  })

  it('fluxo completo: escolhe a sessão, valida por digitação manual, mostra o resultado e libera a próxima', async () => {
    server.use(
      http.get(`${API}/events`, () => HttpResponse.json({ data: [makeEvent()], meta: {} })),
      http.get(`${API}/gate/events/evt-1/stats`, () =>
        HttpResponse.json({ total: 10, used: 3, remaining: 7, lastValidations: [] }),
      ),
      http.post(`${API}/gate/validate`, () =>
        HttpResponse.json({
          result: 'VALID',
          ticket: { seat: 'A1', eventTitle: 'Duna: Parte Dois' },
          usedAt: null,
          validatedBy: null,
          message: 'Entrada liberada',
        }),
      ),
    )

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByLabelText('Sessão deste posto'))
    await user.click(await screen.findByRole('option', { name: /Duna: Parte Dois/ }))

    const input = await screen.findByLabelText('Código do ingresso')
    await user.type(input, 'TKT1.abc.def{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Entrada liberada')
    // digitação manual desabilitada enquanto o resultado ocupa a tela (mesmo "busy")
    expect(screen.getByRole('button', { name: 'Validar' })).toBeDisabled()
  })
})
