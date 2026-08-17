import type { ReactNode } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import CheckoutPage from './CheckoutPage'

// Sem isto, StripeCardForm (importado estaticamente por CheckoutPage, mesmo quando
// o caminho Stripe nunca é exercitado) tentaria carregar o script real da Stripe em
// jsdom. `mockConfirmPayment` -- prefixo `mock` de propósito: é a exceção que o
// Vitest permite referenciar dentro de uma factory de `vi.mock`, apesar do hoisting.
const mockConfirmPayment = vi.fn().mockResolvedValue({})
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}))

const API = env.VITE_API_URL

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    userId: 'u1',
    eventId: 'evt-1',
    status: 'PENDING',
    amountInCents: 6400,
    currency: 'BRL',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    holds: [
      { id: 'hold-1', seatId: 'seat-a1', releasedAt: null },
      { id: 'hold-2', seatId: 'seat-a2', releasedAt: null },
    ],
    ...overrides,
  }
}

function renderAt(initialEntry: { pathname: string; state?: unknown }) {
  return renderWithProviders(
    <Routes>
      <Route path="/checkout/:orderId" element={<CheckoutPage />} />
      <Route path="/checkout/:orderId/retorno" element={<div data-testid="retorno-page" />} />
      <Route path="/eventos/:id/assentos" element={<div data-testid="seat-page" />} />
      <Route path="/" element={<div data-testid="home-page" />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  )
}

afterEach(() => {
  queryClient.clear()
  env.VITE_ALLOW_PAYMENT_TEST_TOGGLE = false
})

describe('CheckoutPage -- criação do pedido', () => {
  it('entra vindo do mapa (eventId + holdIds no state) -- cria o pedido com Idempotency-Key e navega para a URL real', async () => {
    let receivedHeader: string | null = null
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${API}/orders`, async ({ request }) => {
        receivedHeader = request.headers.get('idempotency-key')
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { order: makeOrder(), clientSecret: 'pi_fake_secret' },
          { status: 201 },
        )
      }),
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())),
    )

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] } })

    expect(await screen.findByText('Pagamento')).toBeInTheDocument()
    expect(receivedHeader).toBeTruthy()
    expect(receivedBody).toMatchObject({ eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] })
  })

  it('sem eventId/holdIds no state -- mostra "sessão de checkout inválida", nunca chama a API', async () => {
    let called = false
    server.use(http.post(`${API}/orders`, () => { called = true; return HttpResponse.json({}, { status: 201 }) }))

    renderAt({ pathname: '/checkout/novo' })

    expect(await screen.findByText('Sessão de checkout inválida')).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('HOLD_EXPIRED na criação -- volta para o mapa de assentos com um aviso, não um erro solto', async () => {
    server.use(
      http.post(`${API}/orders`, () =>
        HttpResponse.json({ code: 'HOLD_EXPIRED', message: 'expirou' }, { status: 409 }),
      ),
    )

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1'] } })

    expect(await screen.findByTestId('seat-page')).toBeInTheDocument()
  })
})

describe('CheckoutPage -- formulário de pagamento (fase fake)', () => {
  it('pedido PENDING existente -- mostra o total e o painel de cartões de teste', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())))

    renderAt({ pathname: '/checkout/order-1' })

    expect(await screen.findByText('Total: R$ 64,00')).toBeInTheDocument()
    expect(screen.getByText('4242 4242 4242 4242')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pagar R\$\s?64,00/ })).toBeInTheDocument()
  })

  it('aprovar -- chama simulate-payment com succeeded e navega para o retorno', async () => {
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())),
      http.post(`${API}/orders/order-1/simulate-payment`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderAt({ pathname: '/checkout/order-1' })

    await user.click(await screen.findByRole('button', { name: /Pagar/ }))

    expect(await screen.findByTestId('retorno-page')).toBeInTheDocument()
    expect(receivedBody).toEqual({ outcome: 'succeeded' })
  })

  it('pedido já resolvido (PAID) -- redireciona direto para o retorno, sem mostrar o formulário', async () => {
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ status: 'PAID' }))))

    renderAt({ pathname: '/checkout/order-1' })

    expect(await screen.findByTestId('retorno-page')).toBeInTheDocument()
  })
})

describe('CheckoutPage -- flag de teste do checkout (VITE_ALLOW_PAYMENT_TEST_TOGGLE)', () => {
  it('flag desligada (padrão) -- nunca mostra a telinha de escolha de método', async () => {
    server.use(
      http.post(`${API}/orders`, () => HttpResponse.json({ order: makeOrder(), clientSecret: 'pi_fake_secret' }, { status: 201 })),
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder())),
    )

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] } })

    expect(await screen.findByText('Pagamento')).toBeInTheDocument()
    expect(screen.queryByText('Método de pagamento (teste)')).not.toBeInTheDocument()
  })

  it('flag ligada -- mostra a telinha de escolha antes de criar o pedido; escolher Stripe cria a order com paymentMethod STRIPE e renderiza o form da Stripe', async () => {
    env.VITE_ALLOW_PAYMENT_TEST_TOGGLE = true
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${API}/orders`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { order: makeOrder({ paymentMethod: 'STRIPE' }), clientSecret: 'pi_fake_secret' },
          { status: 201 },
        )
      }),
      http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ paymentMethod: 'STRIPE' }))),
    )
    const user = userEvent.setup()

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] } })

    // telinha de escolha aparece ANTES da order existir -- nenhuma chamada ainda
    expect(await screen.findByText('Método de pagamento (teste)')).toBeInTheDocument()
    expect(receivedBody).toBeNull()

    await user.click(screen.getByLabelText('Método de pagamento (teste)'))
    await user.click(await screen.findByRole('option', { name: 'Stripe (cartão de teste)' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument()
    expect(receivedBody).toMatchObject({ paymentMethod: 'STRIPE' })
    // form fake (Select de aprovar/recusar) não aparece junto do form da Stripe
    expect(screen.queryByLabelText('Resultado do pagamento (simulação)')).not.toBeInTheDocument()
  })

  it('confirmar pagamento na Stripe -- navega para o retorno, mesmo destino do fluxo fake', async () => {
    env.VITE_ALLOW_PAYMENT_TEST_TOGGLE = true
    server.use(http.get(`${API}/orders/order-1`, () => HttpResponse.json(makeOrder({ paymentMethod: 'STRIPE' }))))
    const user = userEvent.setup()

    renderAt({ pathname: '/checkout/novo', state: { eventId: 'evt-1', holdIds: ['hold-1', 'hold-2'] } })

    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    await screen.findByTestId('payment-element')
    await user.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(mockConfirmPayment).toHaveBeenCalled()
    expect(await screen.findByTestId('retorno-page')).toBeInTheDocument()
  })
})
