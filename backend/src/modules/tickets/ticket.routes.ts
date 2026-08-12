import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { TicketController } from './ticket.controller'
import { TicketRepository } from './ticket.repository'
import { listTicketsSchema, ticketIdSchema } from './ticket.schema'
import { TicketService } from './ticket.service'

// exportado -- share.routes.ts reaproveita esta mesma instância em vez de criar um
// segundo TicketRepository (mesmo padrão de catalogService na etapa 05)
export const ticketService = new TicketService(new TicketRepository())
const ticketController = new TicketController(ticketService)

export const ticketRoutes = Router()

ticketRoutes.use(requireAuth, requireRole(Role.CUSTOMER))

ticketRoutes.get('/', validate(listTicketsSchema), ticketController.listMine)
ticketRoutes.get('/:id', validate(ticketIdSchema), ticketController.getById)
ticketRoutes.post('/:id/share', validate(ticketIdSchema), ticketController.createShare)
ticketRoutes.delete('/:id/share', validate(ticketIdSchema), ticketController.revokeShare)
