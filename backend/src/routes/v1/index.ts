import { Router } from 'express'
import { authRoutes } from '../../modules/auth/auth.routes'
import { catalogRoutes } from '../../modules/catalog/catalog.routes'
import { eventsRoutes } from '../../modules/events/events.routes'
import { seatHoldRoutes } from '../../modules/seats/seat-hold.routes'

// próximos módulos entram aqui conforme as etapas seguintes: orders, tickets, gate
export const v1Router = Router()

v1Router.use('/auth', authRoutes)
v1Router.use('/catalog', catalogRoutes)
v1Router.use('/events', eventsRoutes)
// mesmo prefixo de eventsRoutes -- holds são sub-recurso de evento (§ etapa 06)
v1Router.use('/events', seatHoldRoutes)
