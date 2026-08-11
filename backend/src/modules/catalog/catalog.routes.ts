import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { CatalogController } from './catalog.controller'
import { CatalogRepository } from './catalog.repository'
import { getByIdSchema, searchSchema } from './catalog.schema'
import { CatalogService } from './catalog.service'
import { TmdbProvider } from './providers/tmdb.provider'

const catalogRepository = new CatalogRepository()
const tmdbProvider = new TmdbProvider()
const catalogService = new CatalogService(catalogRepository, tmdbProvider)
const catalogController = new CatalogController(catalogService)

export const catalogRoutes = Router()

// catálogo é ferramenta de criação de evento, não vitrine pública -- exigir
// ORGANIZER evita que a API vire um proxy aberto do TMDb com a nossa chave (§4.3)
catalogRoutes.use(requireAuth, requireRole(Role.ORGANIZER))

catalogRoutes.get('/search', validate(searchSchema), catalogController.search)
catalogRoutes.get('/:source/:externalId', validate(getByIdSchema), catalogController.getById)
