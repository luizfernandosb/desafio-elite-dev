import type { Request, Response } from 'express'
import { AppError } from '../../shared/errors'
import type { ImageService } from './image.service'

export class ImageController {
  constructor(private readonly service: ImageService) {}

  upload = async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('INVALID_IMAGE', 'Nenhum arquivo enviado', 400)
    const event = await this.service.upload(req.params.id as string, req.user!.id, req.file.buffer, req.log)
    res.json(event)
  }

  remove = async (req: Request, res: Response) => {
    const event = await this.service.remove(req.params.id as string, req.user!.id, req.log)
    res.json(event)
  }
}
