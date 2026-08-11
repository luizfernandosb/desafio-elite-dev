import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { catalogService } from '../catalog/catalog.routes'
import { EventsController } from './events.controller'
import { EventsRepository } from './events.repository'
import { createEventSchema, eventIdSchema, listEventsSchema, updateEventSchema } from './events.schema'
import { EventsService } from './events.service'

const eventsService = new EventsService(new EventsRepository(), catalogService)
const eventsController = new EventsController(eventsService)

export const eventsRoutes = Router()

eventsRoutes.post(
  '/',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate(createEventSchema),
  eventsController.create,
)

// visibilidade mista -- PUBLISHED é público, DRAFT/CANCELLED só para o próprio dono
eventsRoutes.get('/', optionalAuth, validate(listEventsSchema), eventsController.list)
eventsRoutes.get('/:id', optionalAuth, validate(eventIdSchema), eventsController.getById)
eventsRoutes.get('/:id/seatmap', optionalAuth, validate(eventIdSchema), eventsController.seatmap)

eventsRoutes.patch(
  '/:id',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate(updateEventSchema),
  eventsController.update,
)
eventsRoutes.delete(
  '/:id',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate(eventIdSchema),
  eventsController.remove,
)
eventsRoutes.post(
  '/:id/publish',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate(eventIdSchema),
  eventsController.publish,
)
eventsRoutes.post(
  '/:id/cancel',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate(eventIdSchema),
  eventsController.cancel,
)
