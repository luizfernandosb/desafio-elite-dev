import { z } from 'zod'

export const MAX_SEATS_PER_HOLD = 6

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
