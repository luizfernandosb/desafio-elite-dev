import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Role } from '../../../generated/prisma/enums'
import { env } from '../../config/env'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { GateController } from './gate.controller'
import { GateRepository } from './gate.repository'
import { gateStatsSchema, validateSchema } from './gate.schema'
import { GateService } from './gate.service'

const gateService = new GateService(new GateRepository())
const gateController = new GateController(gateService)

const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
})

export const gateRoutes = Router()

gateRoutes.use(requireAuth, requireRole(Role.GATE))

gateRoutes.post('/validate', validateLimiter, validate(validateSchema), gateController.validate)
gateRoutes.get('/events/:id/stats', validate(gateStatsSchema), gateController.stats)
