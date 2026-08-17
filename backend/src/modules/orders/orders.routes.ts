import { Router } from 'express'
import { PaymentMethod, Role } from '../../../generated/prisma/enums'
import { requireAuth, requireRole } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { EventsRepository } from '../events/events.repository'
import { SeatHoldRepository } from '../seats/seat-hold.repository'
import { SeatStateRepository } from '../seats/seat-state.repository'
import { TicketRepository } from '../tickets/ticket.repository'
import { OrdersController } from './orders.controller'
import { OrdersRepository } from './orders.repository'
import { createOrderSchema, orderIdSchema, simulatePaymentSchema } from './orders.schema'
import { OrdersService } from './orders.service'
import { FakePaymentProvider } from './providers/fake-payment.provider'
import type { PaymentProvider } from './providers/payment-provider'
import { StripePaymentProvider } from './providers/stripe-payment.provider'
import { createStripeWebhookHandler } from './webhook.controller'
import { WebhookEventRepository } from './webhook-event.repository'

const paymentProviders: Record<PaymentMethod, PaymentProvider> = {
  FAKE: new FakePaymentProvider(),
  STRIPE: new StripePaymentProvider(),
}

export const ordersService = new OrdersService(
  new OrdersRepository(),
  new EventsRepository(),
  new SeatHoldRepository(),
  new SeatStateRepository(),
  new TicketRepository(),
  new WebhookEventRepository(),
  paymentProviders,
)
const ordersController = new OrdersController(ordersService)

export const ordersRoutes = Router()

ordersRoutes.post(
  '/',
  requireAuth,
  requireRole(Role.CUSTOMER),
  validate(createOrderSchema),
  ordersController.create,
)
ordersRoutes.get(
  '/:id',
  requireAuth,
  requireRole(Role.CUSTOMER),
  validate(orderIdSchema),
  ordersController.getById,
)
ordersRoutes.post(
  '/:id/simulate-payment',
  requireAuth,
  requireRole(Role.CUSTOMER),
  validate(simulatePaymentSchema),
  ordersController.simulatePayment,
)

export const stripeWebhookHandler = createStripeWebhookHandler(ordersService)
