import { z } from 'zod'
import { CatalogSource, EventAudio, EventFormat, EventStatus, RoomType } from '../../../generated/prisma/enums'
import { BRAZIL_UF_CODES } from '../../shared/brazil-states'
import { isFutureEventStart } from '../../shared/date'
import { paginationSchema } from '../../shared/pagination'
import { isValidSeatLabel, MAX_ROWS, MAX_SEATS_PER_ROW } from './seatmap.service'

function isValidIanaTimezone(timezone: string): boolean {
  try {
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
      format: z.enum(EventFormat).default(EventFormat.TWO_D),
      audio: z.enum(EventAudio).default(EventAudio.DUBBED),
      roomType: z.enum(RoomType).default(RoomType.STANDARD),
      vipSurchargePercent: z.coerce.number().int().min(1).max(300).optional(),
    })
    .refine((data) => isFutureEventStart(data.startsAt), {
      message: 'startsAt deve ser pelo menos 1h à frente do horário atual',
      path: ['startsAt'],
    })
    .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
      message: 'endsAt deve ser depois de startsAt',
      path: ['endsAt'],
    })
    .refine((data) => data.roomType !== RoomType.VIP || data.vipSurchargePercent !== undefined, {
      message: 'Informe a porcentagem adicional da Sala VIP',
      path: ['vipSurchargePercent'],
    }),
}

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
      format: z.enum(EventFormat).optional(),
      audio: z.enum(EventAudio).optional(),
      roomType: z.enum(RoomType).optional(),
      vipSurchargePercent: z.coerce.number().int().min(1).max(300).nullable().optional(),
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
      externalId: z.string().trim().min(1).optional(),
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
