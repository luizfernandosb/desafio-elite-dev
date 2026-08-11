import type { Request, Response } from 'express'
import type { CatalogService } from './catalog.service'
import type { GetByIdParams, SearchQuery } from './catalog.schema'

export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  search = async (req: Request, res: Response) => {
    const { q, page } = req.query as unknown as SearchQuery
    const result = await this.service.search(q, page, req.log)
    res.json(result)
  }

  getById = async (req: Request, res: Response) => {
    const { externalId } = req.params as unknown as GetByIdParams
    const item = await this.service.getById(externalId, req.log)
    res.json(item)
  }
}
