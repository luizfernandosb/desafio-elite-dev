import { randomUUID } from 'node:crypto'
import type { CreateIntentInput, PaymentIntentResult, PaymentProvider } from './payment-provider'

// Plano B documentado (§4.5, §12.1) e dublê nos testes -- fluxo ponta a ponta não
// depende de rede nem de credenciais reais do Stripe. Idempotente do mesmo jeito que o
// Stripe real: a mesma `idempotencyKey` sempre devolve o mesmo intent.
export class FakePaymentProvider implements PaymentProvider {
  readonly supportsSimulation = true as const

  private readonly intentsByIdempotencyKey = new Map<string, PaymentIntentResult>()

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentResult> {
    const cached = this.intentsByIdempotencyKey.get(input.idempotencyKey)
    if (cached) return cached

    const intent: PaymentIntentResult = {
      id: `pi_fake_${randomUUID()}`,
      clientSecret: `pi_fake_${randomUUID()}_secret`,
    }
    this.intentsByIdempotencyKey.set(input.idempotencyKey, intent)
    return intent
  }

  async refund(_intentId: string, _amountInCents?: number): Promise<void> {
    // fake -- nada para reembolsar de verdade
  }
}
