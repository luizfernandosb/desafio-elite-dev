import { z } from 'zod'
import { BRAZIL_UF_CODES } from './brazil-states'
import { MAX_ROWS, MAX_SEATS_PER_ROW } from './room-layout'
import { zonedWallTimeToUtcDate } from './timezones'

export const MAX_SLOTS = 20

const MIN_EVENT_LEAD_MS = 60 * 60 * 1000

const sessionFormatSchema = z.enum(['TWO_D', 'THREE_D'])
const sessionAudioSchema = z.enum(['DUBBED', 'SUBTITLED'])
const sessionRoomTypeSchema = z.enum(['STANDARD', 'VIP'])

function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

function isValidBrazilUf(uf: string): boolean {
  return (BRAZIL_UF_CODES as readonly string[]).includes(uf)
}

const venueStateSchema = z.string().refine(isValidBrazilUf, 'Estado obrigatório')

const slotSchema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().min(1, 'Horário obrigatório'),
})

export type SlotValues = z.infer<typeof slotSchema>

export const venueStepSchema = z
  .object({
    venueName: z.string().trim().min(1, 'Local obrigatório').max(200),
    venueState: venueStateSchema,
    venueCity: z.string().trim().min(1, 'Cidade obrigatória').max(100),
    timezone: z.string().refine(isValidIanaTimezone, 'Fuso horário inválido'),
    slots: z.array(slotSchema).min(1, 'Adicione pelo menos um horário').max(MAX_SLOTS, `Máximo ${MAX_SLOTS} horários por vez`),
  })
  .superRefine((data, ctx) => {
    data.slots.forEach((slot, index) => {
      let hasMinLead = false
      try {
        hasMinLead = zonedWallTimeToUtcDate(slot.date, slot.time, data.timezone).getTime() - Date.now() >= MIN_EVENT_LEAD_MS
      } catch {
        hasMinLead = false
      }
      if (!hasMinLead) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data e hora devem ser pelo menos 1h à frente do horário atual',
          path: ['slots', index, 'date'],
        })
      }
    })
  })

const sessionAttrsSchema = z.object({
  format: sessionFormatSchema,
  audio: sessionAudioSchema,
  roomType: sessionRoomTypeSchema,
  vipSurchargePercent: z.coerce.number().int().min(1).max(300).optional(),
})

export type SessionAttrsValues = z.infer<typeof sessionAttrsSchema>

export const roomStepSchema = z
  .object({
    rows: z.number().int().min(1, 'Mínimo 1 fileira').max(MAX_ROWS, `Máximo ${MAX_ROWS} fileiras`),
    seatsPerRow: z
      .number()
      .int()
      .min(1, 'Mínimo 1 assento por fileira')
      .max(MAX_SEATS_PER_ROW, `Máximo ${MAX_SEATS_PER_ROW} assentos por fileira`),
    priceInReais: z.number().min(0, 'Preço não pode ser negativo'),
    sessions: z.array(sessionAttrsSchema).min(1, 'Adicione pelo menos um horário'),
  })
  .superRefine((data, ctx) => {
    data.sessions.forEach((session, index) => {
      if (session.roomType === 'VIP' && session.vipSurchargePercent === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a porcentagem adicional da Sala VIP',
          path: ['sessions', index, 'vipSurchargePercent'],
        })
      }
    })
  })

export type VenueStepValues = z.infer<typeof venueStepSchema>
export type RoomStepValues = z.infer<typeof roomStepSchema>

export const editEventSchema = z
  .object({
    venueName: z.string().trim().min(1, 'Local obrigatório').max(200),
    venueState: venueStateSchema,
    venueCity: z.string().trim().min(1, 'Cidade obrigatória').max(100),
    synopsis: z.string().max(2000).optional(),
    date: z.string().min(1, 'Data obrigatória'),
    time: z.string().min(1, 'Horário obrigatório'),
    timezone: z.string().refine(isValidIanaTimezone, 'Fuso horário inválido'),
    priceInReais: z.number().min(0, 'Preço não pode ser negativo'),
    format: sessionFormatSchema,
    audio: sessionAudioSchema,
    roomType: sessionRoomTypeSchema,
    vipSurchargePercent: z.coerce.number().int().min(1).max(300).optional(),
  })
  .refine((data) => data.roomType !== 'VIP' || data.vipSurchargePercent !== undefined, {
    message: 'Informe a porcentagem adicional da Sala VIP',
    path: ['vipSurchargePercent'],
  })

export type EditEventValues = z.infer<typeof editEventSchema>
