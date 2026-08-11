import { z } from 'zod'

// teto por requisição de hold -- e por usuário/evento (checado no Service), para que
// um cliente não segure a sala inteira por 10 minutos
export const MAX_SEATS_PER_HOLD = 6

export const createHoldSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    seatIds: z.array(z.string().min(1)).min(1).max(MAX_SEATS_PER_HOLD),
  }),
}

export const releaseHoldSchema = {
  params: z.object({ eventId: z.string().min(1), holdId: z.string().min(1) }),
}

export const listMineSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export type CreateHoldDto = z.infer<typeof createHoldSchema.body>
