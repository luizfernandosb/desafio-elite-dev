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
  // `amountInCents` omitido = reembolso total; informado = parcial (cancelamento de
  // UM assento de um pedido com vários -- nunca estorna o pedido inteiro por engano).
  refund(intentId: string, amountInCents?: number): Promise<void>
  // presente só no `FakePaymentProvider` -- dá ao Service uma forma de checar "esta
  // simulação de pagamento pode rodar?" sem importar a classe concreta (§4.5, etapa
  // 08 do front, "Dia 2": aprovar/recusar sem Stripe de verdade). Trocar para
  // `StripePaymentProvider` (§12, "nada mais muda") faz este capability check virar
  // `undefined` sozinho -- a rota de simulação nunca funciona contra Stripe real.
  readonly supportsSimulation?: true
}
