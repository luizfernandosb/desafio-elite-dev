import { z } from 'zod'
import { CatalogSource } from '../../../generated/prisma/enums'

// TMDb pagina em blocos fixos de 20 -- não aceita `limit`, só `page` (§4.3, §5.6.2)
export const searchSchema = {
  query: z.object({
    q: z.string().trim().min(2).max(100),
    page: z.coerce.number().int().min(1).default(1),
  }),
}

export const getByIdSchema = {
  params: z.object({
    source: z.enum(CatalogSource),
    externalId: z.string().trim().min(1),
  }),
}

export type SearchQuery = z.infer<typeof searchSchema.query>
export type GetByIdParams = z.infer<typeof getByIdSchema.params>
