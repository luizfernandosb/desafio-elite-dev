import type { Request, Response } from 'express'
import type { CitiesParams } from './locations.schema'
import type { LocationsService } from './locations.service'

export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  getStates = async (_req: Request, res: Response) => {
    const data = await this.service.getStates()
    res.json({ data })
  }

  getCities = async (req: Request, res: Response) => {
    const { uf } = req.params as unknown as CitiesParams
    const data = await this.service.getCities(uf)
    res.json({ data })
  }
}
