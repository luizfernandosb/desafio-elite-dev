import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { LocationsController } from './locations.controller'
import { citiesSchema } from './locations.schema'
import { LocationsService } from './locations.service'

export const locationsService = new LocationsService()
const locationsController = new LocationsController(locationsService)

export const locationsRoutes = Router()

locationsRoutes.use(requireAuth, requireRole(Role.ORGANIZER))

locationsRoutes.get('/states', locationsController.getStates)
locationsRoutes.get('/states/:uf/cities', validate(citiesSchema), locationsController.getCities)
