import type { Request, Response } from 'express'
import type { CreateEventDto, ListEventsQuery, UpdateEventDto } from './events.schema'
import type { EventsService } from './events.service'

export class EventsController {
  constructor(private readonly service: EventsService) {}

  create = async (req: Request, res: Response) => {
    const event = await this.service.create(req.user!.id, req.body as CreateEventDto, req.log)
    res.status(201).json(event)
  }

  list = async (req: Request, res: Response) => {
    const query = req.query as unknown as ListEventsQuery
    const result = await this.service.list(query, req.user)
    res.json(result)
  }

  getById = async (req: Request, res: Response) => {
    const event = await this.service.getById(req.params.id as string, req.user)
    res.json(event)
  }

  update = async (req: Request, res: Response) => {
    const event = await this.service.update(
      req.params.id as string,
      req.user!.id,
      req.body as UpdateEventDto,
      req.log,
    )
    res.json(event)
  }

  remove = async (req: Request, res: Response) => {
    await this.service.remove(req.params.id as string, req.user!.id, req.log)
    res.status(204).send()
  }

  publish = async (req: Request, res: Response) => {
    const event = await this.service.publish(req.params.id as string, req.user!.id, req.log)
    res.json(event)
  }

  cancel = async (req: Request, res: Response) => {
    const event = await this.service.cancel(req.params.id as string, req.user!.id, req.log)
    res.json(event)
  }

  seatmap = async (req: Request, res: Response) => {
    const seatmap = await this.service.seatmap(req.params.id as string, req.user)
    res.json(seatmap)
  }
}
