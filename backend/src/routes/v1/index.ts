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

export const v1Router = Router()

v1Router.use('/auth', authRoutes)
v1Router.use('/catalog', catalogRoutes)
v1Router.use('/locations', locationsRoutes)
v1Router.use('/events', eventsRoutes)
v1Router.use('/events', seatHoldRoutes)
v1Router.use('/orders', ordersRoutes)
v1Router.use('/tickets', ticketRoutes)
v1Router.use('/share', shareRoutes)
v1Router.use('/gate', gateRoutes)
