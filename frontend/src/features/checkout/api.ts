import { api } from '../../lib/api'

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'FULFILLED' | 'REFUNDED'
export type SimulateOutcome = 'succeeded' | 'requires_payment_method'
export type PaymentMethod = 'FAKE' | 'STRIPE'

export interface OrderSeatHold {
  id: string
  seatId: string
  expiresAt: string
  releasedAt: string | null
}

export interface Order {
  id: string
  userId: string
  eventId: string
  status: OrderStatus
  amountInCents: number
  currency: string
  // flag de teste do checkout -- decide se esta order específica pode ser resolvida
  // via /simulate-payment (FAKE) ou precisa do Stripe Elements de verdade (STRIPE)
  paymentMethod: PaymentMethod
  expiresAt: string
  createdAt: string
  updatedAt: string
  // incluído pelo back (`orders.repository.ts`) especificamente pra "tentar outro
  // cartão" (§ etapa 08) achar os mesmos assentos sem precisar de estado de
  // navegação -- só os holds ainda ATIVOS (`releasedAt: null`) são reaproveitáveis.
  holds: OrderSeatHold[]
}

export interface CreateOrderResult {
  order: Order
  clientSecret: string
}

export const checkoutKeys = {
  all: ['checkout'] as const,
  order: (id: string) => [...checkoutKeys.all, 'order', id] as const,
  // a criação do pedido também vive numa `useQuery` (não `useMutation`) -- é
  // idempotente pela `idempotencyKey` (header obrigatório), e usar a MESMA key de
  // cache dá de graça a dedupe que "duplo clique não cria dois pedidos" pede (§
  // etapa 08): duas montagens/renders concorrentes com a mesma key compartilham a
  // mesma promise em vez de disparar duas requisições.
  createOrder: (idempotencyKey: string) => [...checkoutKeys.all, 'create-order', idempotencyKey] as const,
}

export function createOrder(
  eventId: string,
  holdIds: string[],
  idempotencyKey: string,
  paymentMethod: PaymentMethod = 'FAKE',
) {
  return api.post<CreateOrderResult>(
    '/orders',
    { eventId, holdIds, paymentMethod },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
}

export function getOrder(id: string) {
  return api.get<Order>(`/orders/${id}`)
}

export function simulatePayment(orderId: string, outcome: SimulateOutcome) {
  return api.post<void>(`/orders/${orderId}/simulate-payment`, { outcome })
}
