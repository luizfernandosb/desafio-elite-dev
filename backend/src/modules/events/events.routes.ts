import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { uploadImage } from '../../middlewares/upload.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { catalogService } from '../catalog/catalog.routes'
import { EventsController } from './events.controller'
import { EventsRepository } from './events.repository'
import { createEventSchema, eventIdSchema, listEventsSchema, updateEventSchema } from './events.schema'
import { EventsService } from './events.service'
import { ImageController } from './image.controller'
import { ImageService } from './image.service'
import { SupabaseStorageProvider } from './providers/supabase-storage.provider'

const eventsRepo = new EventsRepository()
const eventsService = new EventsService(eventsRepo, catalogService)
const eventsController = new EventsController(eventsService)

const imageService = new ImageService(eventsRepo, new SupabaseStorageProvider())
const imageController = new ImageController(imageService)

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

// params antes do multipart -- barato (checa formato do id) antes de caro (parseia o
// corpo multipart inteiro), mesmo raciocínio de ordem da etapa 10 (portaria)
eventsRoutes.post(
  '/:id/image',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate({ params: eventIdSchema.params }),
  uploadImage,
  imageController.upload,
)
eventsRoutes.delete(
  '/:id/image',
  requireAuth,
  requireRole(Role.ORGANIZER),
  validate(eventIdSchema),
  imageController.remove,
)
