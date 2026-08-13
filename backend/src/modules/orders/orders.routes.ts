import { Router } from 'express'
import { Role } from '../../../generated/prisma/enums'
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
import { createStripeWebhookHandler } from './webhook.controller'
import { WebhookEventRepository } from './webhook-event.repository'

// FakePaymentProvider por padrão -- trocar pela StripePaymentProvider (já implementada,
// mesma interface) é a única linha que muda quando houver uma chave de teste real do
// Stripe configurada (§4.5, §12: "nada mais muda").
const paymentProvider: PaymentProvider = new FakePaymentProvider()

export const ordersService = new OrdersService(
  new OrdersRepository(),
  new EventsRepository(),
  new SeatHoldRepository(),
  new SeatStateRepository(),
  new TicketRepository(),
  new WebhookEventRepository(),
  paymentProvider,
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
// substituto de dev para o webhook do Stripe (§4.5, etapa 08 do front, "Dia 2") --
// só funciona com `FakePaymentProvider` (`supportsSimulation`, checado no Service);
// trocar para Stripe real (§12) faz este endpoint parar de funcionar sozinho.
ordersRoutes.post(
  '/:id/simulate-payment',
  requireAuth,
  requireRole(Role.CUSTOMER),
  validate(simulatePaymentSchema),
  ordersController.simulatePayment,
)

// composto aqui (mesma instância de OrdersService) mas montado direto em app.ts, antes
// do express.json() -- ver comentário lá sobre por que não pode passar por v1Router
export const stripeWebhookHandler = createStripeWebhookHandler(ordersService)
