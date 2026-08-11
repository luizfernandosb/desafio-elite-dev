import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Role } from '../../../generated/prisma/enums'
import { env } from '../../config/env'
import { EventsRepository } from '../events/events.repository'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { SeatHoldController } from './seat-hold.controller'
import { SeatHoldRepository } from './seat-hold.repository'
import { createHoldSchema, listMineSchema, releaseHoldSchema } from './seat-hold.schema'
import { SeatHoldService } from './seat-hold.service'
import { SeatRepository } from './seat.repository'
import { SeatStateRepository } from './seat-state.repository'

const seatHoldService = new SeatHoldService(
  new SeatHoldRepository(),
  new SeatStateRepository(),
  new EventsRepository(),
  new SeatRepository(),
)
const seatHoldController = new SeatHoldController(seatHoldService)

// contém abuso de criação de hold (spam de reservas) -- desligado em teste pelo mesmo
// motivo dos limiters de /auth (§7.10.2, suíte roda em série no mesmo processo)
const holdLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
})

export const seatHoldRoutes = Router()

seatHoldRoutes.post(
  '/:id/holds',
  requireAuth,
  requireRole(Role.CUSTOMER),
  holdLimiter,
  validate(createHoldSchema),
  seatHoldController.create,
)
seatHoldRoutes.delete(
  '/:eventId/holds/:holdId',
  requireAuth,
  requireRole(Role.CUSTOMER),
  validate(releaseHoldSchema),
  seatHoldController.release,
)
seatHoldRoutes.get(
  '/:id/holds/mine',
  requireAuth,
  requireRole(Role.CUSTOMER),
  validate(listMineSchema),
  seatHoldController.listMine,
)
