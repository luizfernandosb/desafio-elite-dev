import { Router } from 'express'
import { authRoutes } from '../../modules/auth/auth.routes'
import { catalogRoutes } from '../../modules/catalog/catalog.routes'
import { eventsRoutes } from '../../modules/events/events.routes'
import { ordersRoutes } from '../../modules/orders/orders.routes'
import { seatHoldRoutes } from '../../modules/seats/seat-hold.routes'

// próximos módulos entram aqui conforme as etapas seguintes: tickets, gate
export const v1Router = Router()

v1Router.use('/auth', authRoutes)
v1Router.use('/catalog', catalogRoutes)
v1Router.use('/events', eventsRoutes)
// mesmo prefixo de eventsRoutes -- holds são sub-recurso de evento (§ etapa 06)
v1Router.use('/events', seatHoldRoutes)
v1Router.use('/orders', ordersRoutes)
// POST /api/v1/stripe/webhook é montado direto em app.ts (§ etapa 07) -- precisa vir
// antes do express.json(), então não pode passar por este router
