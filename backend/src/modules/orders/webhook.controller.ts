import type { Request, Response } from 'express'
import type Stripe from 'stripe'
import { env } from '../../config/env'
import { logger } from '../../lib/logger'
import { stripe } from '../../lib/stripe'
import { NotFoundError } from '../../shared/errors'
import type { OrdersService } from './orders.service'

const HANDLED_EVENT_TYPES = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
])

// chega antes do express.json() (body cru, montado em app.ts) -- req.log já existe
// (requestLogger roda primeiro), mas um logger filho próprio, com stripeEventId,
// evita ficar preso ao formato genérico de log de requisição (§5.5.7)
export function createStripeWebhookHandler(ordersService: OrdersService) {
  return async (req: Request, res: Response) => {
    const webhookLog = logger.child({ requestId: req.id, handler: 'stripe-webhook' })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'] as string,
        env.STRIPE_WEBHOOK_SECRET,
      )
    } catch (err) {
      webhookLog.warn({ msg: 'webhook signature invalid', err })
      return res.status(400).json({ code: 'INVALID_SIGNATURE', message: 'Assinatura inválida' })
    }

    const log = webhookLog.child({ stripeEventId: event.id })
    log.info({ msg: 'webhook received', type: event.type })

    try {
      const isNew = await ordersService.recordWebhookEvent(event.id, event.type)
      if (!isNew) {
        log.info({ msg: 'webhook já processado -- ignorando (entrega duplicada)' })
        return res.json({ received: true })
      }

      if (HANDLED_EVENT_TYPES.has(event.type)) {
        const intent = event.data.object as Stripe.PaymentIntent

        if (event.type === 'payment_intent.succeeded') {
          await ordersService.handleWebhookPaymentSucceeded(intent.id, log)
        } else {
          await ordersService.handleWebhookPaymentFailed(intent.id, log)
        }
      } else {
        log.info({ msg: 'tipo de evento ignorado' })
      }

      res.json({ received: true })
    } catch (err) {
      if (err instanceof NotFoundError) {
        // falha permanente -- a Order não existe pra esse intent, reentregar não resolve
        log.error({ msg: 'falha permanente ao processar webhook', type: event.type, err })
        return res.json({ received: true })
      }

      // falha transitória (banco fora, etc.) -- 500 faz o Stripe reentregar
      log.error({ msg: 'falha ao processar webhook', type: event.type, err })
      res.status(500).json({ code: 'PROCESSING_ERROR' })
    }
  }
}
