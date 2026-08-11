import { stripe } from '../../../lib/stripe'
import { AppError } from '../../../shared/errors'
import type { CreateIntentInput, PaymentIntentResult, PaymentProvider } from './payment-provider'

export class StripePaymentProvider implements PaymentProvider {
  async createIntent(input: CreateIntentInput): Promise<PaymentIntentResult> {
    const intent = await stripe.paymentIntents.create(
      {
        amount: input.amountInCents,
        currency: input.currency.toLowerCase(),
        metadata: input.metadata,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: input.idempotencyKey },
    )

    if (!intent.client_secret) {
      throw new AppError('PAYMENT_PROVIDER_ERROR', 'Stripe não retornou client_secret', 502)
    }

    return { id: intent.id, clientSecret: intent.client_secret }
  }

  async refund(intentId: string): Promise<void> {
    await stripe.refunds.create({ payment_intent: intentId })
  }
}
