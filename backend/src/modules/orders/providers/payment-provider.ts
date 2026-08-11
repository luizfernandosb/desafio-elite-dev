// Interface desde o primeiro commit (§4.5, §12) -- é o que permite trocar
// FakePaymentProvider por StripePaymentProvider sem tocar em orders.service.ts.
export interface CreateIntentInput {
  amountInCents: number
  currency: string
  metadata: Record<string, string>
  idempotencyKey: string
}

export interface PaymentIntentResult {
  id: string
  clientSecret: string
}

export interface PaymentProvider {
  createIntent(input: CreateIntentInput): Promise<PaymentIntentResult>
  refund(intentId: string): Promise<void>
}
