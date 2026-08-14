import { z } from 'zod'

// teto por requisição de hold -- e por usuário/evento (checado no Service), para que
// um cliente não segure a sala inteira por 10 minutos
export const MAX_SEATS_PER_HOLD = 6

// Meia-entrada (§ TicketPriceType): decidida por assento, no momento da reserva --
// o cliente diz que TIPO de ingresso quer para cada assento, nunca quanto isso
// custa (o preço nunca vem do corpo, ver orders.schema.ts).
const seatSelectionSchema = z.object({
  seatId: z.string().min(1),
  priceType: z.enum(['FULL', 'HALF']).default('FULL'),
})

export const createHoldSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    seats: z.array(seatSelectionSchema).min(1).max(MAX_SEATS_PER_HOLD),
  }),
}

export const releaseHoldSchema = {
  params: z.object({ eventId: z.string().min(1), holdId: z.string().min(1) }),
}

export const listMineSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export type CreateHoldDto = z.infer<typeof createHoldSchema.body>
export type SeatSelectionDto = z.infer<typeof seatSelectionSchema>
