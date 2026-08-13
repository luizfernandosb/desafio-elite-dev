import { authHandlers } from './auth'
import { catalogHandlers } from './catalog'
import { eventsHandlers } from './events'
import { gateHandlers } from './gate'
import { locationsHandlers } from './locations'
import { ordersHandlers, resetOrdersStore } from './orders'
import { seatsHandlers } from './seats'
import { resetTicketsStore, ticketsHandlers } from './tickets'

// Ordem importa para o MSW (primeiro handler que casa a rota vence): leituras
// públicas (`catalog`) antes das de organizador (`events`) garante que `GET
// /events`/`GET /events/:id` sempre respondem o evento público por padrão --
// quem precisa do ponto de vista do organizador sobrescreve com `server.use`
// (todo teste de organizador já faz isso hoje).
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

// Estado mutável (pedidos/ingressos emitidos) não é resetado por
// `server.resetHandlers()` -- só limpa overrides de `server.use`. Testes que
// dependem da emissão de ingresso pelo pagamento simulado (§ etapa 13, fluxos
// ponta a ponta) chamam isto entre cenários.
export function resetTestStores(): void {
  resetOrdersStore()
  resetTicketsStore()
}
