import type { Request, Response } from 'express'
import type { TicketService } from './ticket.service'

export class ShareController {
  constructor(private readonly service: TicketService) {}

  getByToken = async (req: Request, res: Response) => {
    const view = await this.service.getSharedTicket(req.params.shareToken as string)

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex')
    res.json(view)
  }
}
