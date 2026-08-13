import { z } from 'zod'
import { BRAZIL_UF_CODES } from './brazil-states'
import { MAX_ROWS, MAX_SEATS_PER_ROW } from './room-layout'
import { zonedWallTimeToUtcDate } from './timezones'

// máximo de horários por lote na criação -- mesmo raciocínio de MAX_ROWS/
// MAX_SEATS_PER_ROW: um teto arbitrário mas generoso evita um clique acidental
// criando centenas de sessões de uma vez
export const MAX_SLOTS = 20

const sessionFormatSchema = z.enum(['TWO_D', 'THREE_D'])
const sessionAudioSchema = z.enum(['DUBBED', 'SUBTITLED'])
const sessionRoomTypeSchema = z.enum(['STANDARD', 'VIP'])

function isValidIanaTimezone(timezone: string): boolean {
  try {
    // lança RangeError para qualquer coisa que não seja um fuso IANA reconhecido --
    // mesmo teste do back-end (events.schema.ts), não regex artesanal (§4.6.3)
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

// Espelha backend/src/modules/events/events.schema.ts (createEventSchema) -- mesmos
// limites, validados aqui só para feedback rápido; a autoridade é sempre o servidor.
// `slots` (em vez de um `date`/`time` único) permite criar várias sessões de uma vez
// -- mesmo filme/local/sala/preço, horários diferentes -- sem repetir o assistente
// inteiro por horário (ver CreateEventWizard.tsx).
export const venueStepSchema = z
  .object({
    venueName: z.string().trim().min(1, 'Local obrigatório').max(200),
    venueState: venueStateSchema,
    venueCity: z.string().trim().min(1, 'Cidade obrigatória').max(100),
    timezone: z.string().refine(isValidIanaTimezone, 'Fuso horário inválido'),
    slots: z.array(slotSchema).min(1, 'Adicione pelo menos um horário').max(MAX_SLOTS, `Máximo ${MAX_SLOTS} horários por vez`),
  })
  // conversão consciente do fuso ESCOLHIDO, não do fuso da máquina que roda o
  // formulário -- mesma função usada para montar o `startsAt` enviado ao back (§4.6.3).
  // `superRefine` (não `refine`) porque o erro precisa apontar pro slot ERRADO, não
  // pro array inteiro -- cada horário é validado e reportado com seu próprio índice.
  .superRefine((data, ctx) => {
    data.slots.forEach((slot, index) => {
      let isFuture = false
      try {
        isFuture = zonedWallTimeToUtcDate(slot.date, slot.time, data.timezone).getTime() > Date.now()
      } catch {
        isFuture = false
      }
      if (!isFuture) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data e hora devem ser no futuro',
          path: ['slots', index, 'date'],
        })
      }
    })
  })

// Formato/áudio/sala variam por horário -- a mesma sala física pode passar o filme
// dublado às 19h e legendado às 22h, ou virar sessão VIP só numa das exibições -- por
// isso um item por horário (mesma ordem de `venueStepSchema.slots`), não um valor
// só pro lote inteiro (ver RoomStep.tsx).
const sessionAttrsSchema = z.object({
  format: sessionFormatSchema,
  audio: sessionAudioSchema,
  roomType: sessionRoomTypeSchema,
  // só obrigatório quando roomType === 'VIP' (ver superRefine abaixo) -- mesmos
  // limites do back (events.schema.ts)
  vipSurchargePercent: z.coerce.number().int().min(1).max(300).optional(),
})

export type SessionAttrsValues = z.infer<typeof sessionAttrsSchema>

// rows/seatsPerRow/priceInReais espelham MAX_ROWS/MAX_SEATS_PER_ROW do back
// (seatmap.service.ts, 26 e 40) -- accessibleSeats não entra aqui: vem do clique no
// SeatMap, não de um campo de texto, e não tem "inválido" possível (o próprio
// componente só gera rótulos dentro do layout atual). Sem `z.coerce` em rows/
// seatsPerRow/priceInReais: o `<input>` já entrega `number` via `register(campo, {
// valueAsNumber: true })`, então o tipo de entrada e saída do schema é o mesmo --
// evita a divergência de tipo do RHF entre valor "de tela" (string) e valor validado
// (number) que `z.coerce` introduziria aqui. Sala/local/preço continuam um valor só
// pro lote inteiro (mesma sala física, mesmo preço-base); só `sessions` varia por
// horário.
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
  // `superRefine` (não `refine`) pelo mesmo motivo do `slots` em `venueStepSchema`:
  // o erro precisa apontar pro horário ERRADO, não pro array inteiro.
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

// Campos editáveis fora do wizard (gestão da sessão) -- mesmos que o back aceita em
// PATCH /events/:id, exceto os que ficam bloqueados após venda (ver EventEditForm.tsx).
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
