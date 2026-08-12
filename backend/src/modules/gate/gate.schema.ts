import { z } from 'zod'

export const validateSchema = {
  body: z.object({
    code: z.string().min(1),
    eventId: z.string().min(1),
  }),
}

export const gateStatsSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export type ValidateDto = z.infer<typeof validateSchema.body>
