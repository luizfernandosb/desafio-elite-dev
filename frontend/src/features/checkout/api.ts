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
  paymentMethod: PaymentMethod
  expiresAt: string
  createdAt: string
  updatedAt: string
  holds: OrderSeatHold[]
}

export interface CreateOrderResult {
  order: Order
  clientSecret: string
}

export const checkoutKeys = {
  all: ['checkout'] as const,
  order: (id: string) => [...checkoutKeys.all, 'order', id] as const,
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
