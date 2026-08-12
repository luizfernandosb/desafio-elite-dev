import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/env'
import { validate } from '../../middlewares/validate.middleware'
import { ShareController } from './share.controller'
import { publicShareSchema } from './ticket.schema'
import { ticketService } from './ticket.routes'

const shareController = new ShareController(ticketService)

// mais agressivo que o global -- token de 32 bytes é inviável de força bruta, mas o
// limite corta varredura e protege o banco (§ etapa 09)
const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
})

export const shareRoutes = Router()

// sem requireAuth -- é o ponto do requisito (§7.7). A allowlist de CORS do app.ts
// continua valendo (não há exceção aqui); quem chama esta rota é a própria página de
// compartilhamento do front, cuja origem já está em CORS_ORIGINS.
shareRoutes.get('/:shareToken', shareLimiter, validate(publicShareSchema), shareController.getByToken)
