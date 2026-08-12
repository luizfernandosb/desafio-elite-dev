import { z } from 'zod'
import { paginationSchema } from '../../shared/pagination'

export const listTicketsSchema = {
  query: paginationSchema,
}

export const ticketIdSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export const publicShareSchema = {
  params: z.object({ shareToken: z.string().min(1) }),
}
