import { z } from 'zod'
import { MAX_SEATS_PER_HOLD } from '../seats/seat-hold.schema'

// nenhum campo de valor aqui -- amountInCents é sempre calculado no servidor a partir
// de event.priceInCents (§ etapa 07). Aceitar do corpo seria a fraude mais óbvia possível.
export const createOrderSchema = {
  body: z.object({
    eventId: z.string().min(1),
    holdIds: z.array(z.string().min(1)).min(1).max(MAX_SEATS_PER_HOLD),
  }),
}

export const orderIdSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export type CreateOrderDto = z.infer<typeof createOrderSchema.body>
