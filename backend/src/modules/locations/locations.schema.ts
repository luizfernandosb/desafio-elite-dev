import { z } from 'zod'
import { BRAZIL_UF_CODES } from '../../shared/brazil-states'

export const citiesSchema = {
  params: z.object({ uf: z.enum(BRAZIL_UF_CODES) }),
}

export type CitiesParams = z.infer<typeof citiesSchema.params>
