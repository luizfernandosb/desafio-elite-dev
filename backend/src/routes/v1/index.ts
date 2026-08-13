import { Router } from 'express'
import { authRoutes } from '../../modules/auth/auth.routes'
import { catalogRoutes } from '../../modules/catalog/catalog.routes'
import { eventsRoutes } from '../../modules/events/events.routes'
import { gateRoutes } from '../../modules/gate/gate.routes'
import { locationsRoutes } from '../../modules/locations/locations.routes'
import { ordersRoutes } from '../../modules/orders/orders.routes'
import { seatHoldRoutes } from '../../modules/seats/seat-hold.routes'
import { shareRoutes } from '../../modules/tickets/share.routes'
import { ticketRoutes } from '../../modules/tickets/ticket.routes'

// núcleo do desafio completo depois desta etapa (§ etapa 10)
export const v1Router = Router()

v1Router.use('/auth', authRoutes)
v1Router.use('/catalog', catalogRoutes)
v1Router.use('/locations', locationsRoutes)
v1Router.use('/events', eventsRoutes)
// mesmo prefixo de eventsRoutes -- holds são sub-recurso de evento (§ etapa 06)
v1Router.use('/events', seatHoldRoutes)
v1Router.use('/orders', ordersRoutes)
v1Router.use('/tickets', ticketRoutes)
v1Router.use('/share', shareRoutes)
v1Router.use('/gate', gateRoutes)
// POST /api/v1/stripe/webhook é montado direto em app.ts (§ etapa 07) -- precisa vir
// antes do express.json(), então não pode passar por este router
