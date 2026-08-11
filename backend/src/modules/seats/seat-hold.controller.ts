import type { Request, Response } from 'express'
import type { CreateHoldDto } from './seat-hold.schema'
import type { SeatHoldService } from './seat-hold.service'

export class SeatHoldController {
  constructor(private readonly service: SeatHoldService) {}

  create = async (req: Request, res: Response) => {
    const { seatIds } = req.body as CreateHoldDto
    const holds = await this.service.hold(req.user!.id, req.params.id as string, seatIds, req.log)
    res.status(201).json({ data: holds })
  }

  release = async (req: Request, res: Response) => {
    await this.service.release(
      req.user!.id,
      req.params.eventId as string,
      req.params.holdId as string,
      req.log,
    )
    res.status(204).send()
  }

  listMine = async (req: Request, res: Response) => {
    const holds = await this.service.listMine(req.user!.id, req.params.id as string)
    res.json({ data: holds })
  }
}
