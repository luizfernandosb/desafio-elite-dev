import type { Request, Response } from 'express'
import { ValidationError } from '../../shared/errors'
import type { CreateOrderDto, SimulatePaymentDto } from './orders.schema'
import type { OrdersService } from './orders.service'

export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  create = async (req: Request, res: Response) => {
    const idempotencyKey = req.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
      throw new ValidationError('Header Idempotency-Key é obrigatório')
    }

    const result = await this.service.createOrder(
      req.user!.id,
      req.body as CreateOrderDto,
      idempotencyKey,
      req.log,
    )
    res.status(201).json(result)
  }

  getById = async (req: Request, res: Response) => {
    const order = await this.service.getById(req.params.id as string, req.user!.id)
    res.json(order)
  }

  simulatePayment = async (req: Request, res: Response) => {
    const { outcome } = req.body as SimulatePaymentDto
    await this.service.simulatePayment(req.params.id as string, req.user!.id, outcome, req.log)
    res.status(204).send()
  }
}
