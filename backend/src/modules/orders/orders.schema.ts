import { z } from 'zod'
import { MAX_SEATS_PER_HOLD } from '../seats/seat-hold.schema'

export const createOrderSchema = {
  body: z.object({
    eventId: z.string().min(1),
    holdIds: z.array(z.string().min(1)).min(1).max(MAX_SEATS_PER_HOLD),
    paymentMethod: z.enum(['FAKE', 'STRIPE']).default('FAKE'),
  }),
}

export const orderIdSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export const simulatePaymentSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ outcome: z.enum(['succeeded', 'requires_payment_method']) }),
}

export type CreateOrderDto = z.infer<typeof createOrderSchema.body>
export type SimulatePaymentDto = z.infer<typeof simulatePaymentSchema.body>
