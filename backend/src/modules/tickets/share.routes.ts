import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/env'
import { validate } from '../../middlewares/validate.middleware'
import { ShareController } from './share.controller'
import { publicShareSchema } from './ticket.schema'
import { ticketService } from './ticket.routes'

const shareController = new ShareController(ticketService)

const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
})

export const shareRoutes = Router()

shareRoutes.get('/:shareToken', shareLimiter, validate(publicShareSchema), shareController.getByToken)
