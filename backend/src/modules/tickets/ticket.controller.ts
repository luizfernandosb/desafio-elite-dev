import type { Request, Response } from 'express'
import type { PaginationQuery } from '../../shared/pagination'
import type { TicketService } from './ticket.service'

export class TicketController {
  constructor(private readonly service: TicketService) {}

  listMine = async (req: Request, res: Response) => {
    const query = req.query as unknown as PaginationQuery
    const result = await this.service.listMine(req.user!.id, query)
    res.json(result)
  }

  getById = async (req: Request, res: Response) => {
    const ticket = await this.service.getById(req.params.id as string, req.user!.id)
    res.json(ticket)
  }

  createShare = async (req: Request, res: Response) => {
    const link = await this.service.createShareLink(req.params.id as string, req.user!.id, req.log)
    res.status(201).json(link)
  }

  revokeShare = async (req: Request, res: Response) => {
    await this.service.revokeShareLink(req.params.id as string, req.user!.id, req.log)
    res.status(204).send()
  }
}
