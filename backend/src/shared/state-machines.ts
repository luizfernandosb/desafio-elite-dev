import { EventStatus, OrderStatus, TicketStatus } from '../../generated/prisma/enums'
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

export const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
  PUBLISHED: [EventStatus.CANCELLED],
  CANCELLED: [],
}

export function assertTransition<S extends string>(
  transitions: Record<S, S[]>,
  from: S,
  to: S,
): void {
  if (!transitions[from].includes(to)) {
    throw new InvalidTransitionError(`${from} → ${to}`)
  }
}
