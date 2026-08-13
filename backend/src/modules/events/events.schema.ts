import { z } from 'zod'
import { CatalogSource, EventStatus } from '../../../generated/prisma/enums'
import { BRAZIL_UF_CODES } from '../../shared/brazil-states'
import { paginationSchema } from '../../shared/pagination'
import { isValidSeatLabel, MAX_ROWS, MAX_SEATS_PER_ROW } from './seatmap.service'

function isValidIanaTimezone(timezone: string): boolean {
  try {
    // lança RangeError para qualquer coisa que não seja um fuso IANA reconhecido --
    // não escrever regex artesanal de fuso horário (§4.6.3)
    new Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

const timezoneSchema = z.string().refine(isValidIanaTimezone, 'Fuso horário IANA inválido')

const layoutSchema = z
  .object({
    rows: z.coerce.number().int().min(1).max(MAX_ROWS),
    seatsPerRow: z.coerce.number().int().min(1).max(MAX_SEATS_PER_ROW),
    accessibleSeats: z.array(z.string()).optional(),
  })
  .refine(
    (layout) => (layout.accessibleSeats ?? []).every((label) => isValidSeatLabel(label, layout)),
    { message: 'accessibleSeats contém assento fora do layout', path: ['accessibleSeats'] },
  )

export const createEventSchema = {
  body: z
    .object({
      source: z.literal(CatalogSource.TMDB),
      externalId: z.string().trim().min(1),
      venueName: z.string().trim().min(1).max(200),
      venueCity: z.string().trim().min(1).max(100),
      venueState: z.enum(BRAZIL_UF_CODES),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date().optional(),
      timezone: timezoneSchema,
      priceInCents: z.number().int().nonnegative(),
      layout: layoutSchema,
      // nenhum campo `organizerId`, `type` ou `status` aqui -- vêm do servidor (§7.5)
    })
    .refine((data) => data.startsAt.getTime() > Date.now(), {
      message: 'startsAt deve ser no futuro',
      path: ['startsAt'],
    })
    .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
      message: 'endsAt deve ser depois de startsAt',
      path: ['endsAt'],
    }),
}

// campos que não alteram o contrato de compra ficam sempre editáveis; os que alteram
// (data, fuso, preço, cidade) só quando o evento ainda não vendeu ingresso -- checado
// no Service, que conhece o estado atual do evento (§ etapa 05, "PATCH com vendas").
// `imageUrl` propositalmente fora daqui (etapa 12): só muda via POST/DELETE
// /events/:id/image, que passa pela validação de magic bytes -- um PATCH aceitando
// qualquer URL seria um segundo caminho para o mesmo campo, sem a validação do primeiro.
export const updateEventSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      venueName: z.string().trim().min(1).max(200).optional(),
      synopsis: z.string().max(2000).optional(),
      venueCity: z.string().trim().min(1).max(100).optional(),
      venueState: z.enum(BRAZIL_UF_CODES).optional(),
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
      timezone: timezoneSchema.optional(),
      priceInCents: z.number().int().nonnegative().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, 'Nada para atualizar'),
}

export const listEventsSchema = {
  query: paginationSchema
    .extend({
      q: z.string().trim().max(100).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      status: z.enum(EventStatus).default(EventStatus.PUBLISHED),
    })
    .refine((data) => !data.from || !data.to || data.from <= data.to, {
      message: '`from` deve ser anterior a `to`',
      path: ['from'],
    }),
}

export const eventIdSchema = {
  params: z.object({ id: z.string().min(1) }),
}

export type CreateEventDto = z.infer<typeof createEventSchema.body>
export type UpdateEventDto = z.infer<typeof updateEventSchema.body>
export type ListEventsQuery = z.infer<typeof listEventsSchema.query>
