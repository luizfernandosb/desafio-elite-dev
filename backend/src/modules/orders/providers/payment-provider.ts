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
  refund(intentId: string, amountInCents?: number): Promise<void>
  readonly supportsSimulation?: true
}
