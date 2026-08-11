import { Router } from 'express'
import { authRoutes } from '../../modules/auth/auth.routes'
import { catalogRoutes } from '../../modules/catalog/catalog.routes'

// próximos módulos entram aqui conforme as etapas seguintes: events, orders, tickets, gate
export const v1Router = Router()

v1Router.use('/auth', authRoutes)
v1Router.use('/catalog', catalogRoutes)
