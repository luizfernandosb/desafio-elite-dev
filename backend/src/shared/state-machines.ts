import { OrderStatus, TicketStatus } from '../../generated/prisma/enums'
import { InvalidTransitionError } from './errors'

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.FAILED, OrderStatus.EXPIRED],
  PAID: [OrderStatus.FULFILLED, OrderStatus.REFUNDED],
  FAILED: [],
  EXPIRED: [],
  FULFILLED: [OrderStatus.REFUNDED],
  REFUNDED: [],
}

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  ACTIVE: [TicketStatus.USED, TicketStatus.CANCELLED],
  USED: [],
  CANCELLED: [],
}

// Efeito colateral desejado: repetir uma transição já concluída (ex.: webhook duplicado
// numa Order já PAID) lança em vez de reaplicar -- o Service decide se isso é erro ou
// no-op idempotente; assertTransition só garante que a tabela é a única fonte da verdade.
export function assertTransition<S extends string>(
  transitions: Record<S, S[]>,
  from: S,
  to: S,
): void {
  if (!transitions[from].includes(to)) {
    throw new InvalidTransitionError(`${from} → ${to}`)
  }
}
