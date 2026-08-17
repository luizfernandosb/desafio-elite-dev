import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { CatalogController } from './catalog.controller'
import { CatalogRepository } from './catalog.repository'
import { getByIdSchema, searchSchema } from './catalog.schema'
import { CatalogService } from './catalog.service'
import { TmdbProvider } from './providers/tmdb.provider'

export const catalogService = new CatalogService(new CatalogRepository(), new TmdbProvider())
const catalogController = new CatalogController(catalogService)

export const catalogRoutes = Router()

catalogRoutes.use(requireAuth, requireRole(Role.ORGANIZER))

catalogRoutes.get('/search', validate(searchSchema), catalogController.search)
catalogRoutes.get('/:source/:externalId', validate(getByIdSchema), catalogController.getById)
