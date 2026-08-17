import { authHandlers } from './auth'
import { catalogHandlers } from './catalog'
import { eventsHandlers } from './events'
import { gateHandlers } from './gate'
import { locationsHandlers } from './locations'
import { ordersHandlers, resetOrdersStore } from './orders'
import { seatsHandlers } from './seats'
import { resetTicketsStore, ticketsHandlers } from './tickets'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...eventsHandlers,
  ...locationsHandlers,
  ...seatsHandlers,
  ...ordersHandlers,
  ...ticketsHandlers,
  ...gateHandlers,
]

export function resetTestStores(): void {
  resetOrdersStore()
  resetTicketsStore()
}
