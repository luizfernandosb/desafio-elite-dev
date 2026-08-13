import { z } from 'zod'
import { BRAZIL_UF_CODES } from './brazil-states'
import { MAX_ROWS, MAX_SEATS_PER_ROW } from './room-layout'
import { zonedWallTimeToUtcDate } from './timezones'

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

// Espelha backend/src/modules/events/events.schema.ts (createEventSchema) -- mesmos
// limites, validados aqui só para feedback rápido; a autoridade é sempre o servidor.
export const venueStepSchema = z
  .object({
    venueName: z.string().trim().min(1, 'Local obrigatório').max(200),
    venueState: venueStateSchema,
    venueCity: z.string().trim().min(1, 'Cidade obrigatória').max(100),
    date: z.string().min(1, 'Data obrigatória'),
    time: z.string().min(1, 'Horário obrigatório'),
    timezone: z.string().refine(isValidIanaTimezone, 'Fuso horário inválido'),
  })
  // conversão consciente do fuso ESCOLHIDO, não do fuso da máquina que roda o
  // formulário -- mesma função usada para montar o `startsAt` enviado ao back (§4.6.3)
  .refine(
    (data) => {
      try {
        return zonedWallTimeToUtcDate(data.date, data.time, data.timezone).getTime() > Date.now()
      } catch {
        return false
      }
    },
    { message: 'Data e hora devem ser no futuro', path: ['date'] },
  )

// rows/seatsPerRow espelham MAX_ROWS/MAX_SEATS_PER_ROW do back (seatmap.service.ts,
// 26 e 40) -- accessibleSeats não entra aqui: vem do clique no SeatMap, não de um
// campo de texto, e não tem "inválido" possível (o próprio componente só gera
// rótulos dentro do layout atual). Sem `z.coerce`: o `<input>` já entrega `number`
// via `register(campo, { valueAsNumber: true })`, então o tipo de entrada e saída do
// schema é o mesmo -- evita a divergência de tipo do RHF entre valor "de tela"
// (string) e valor validado (number) que `z.coerce` introduziria aqui.
export const roomStepSchema = z.object({
  rows: z.number().int().min(1, 'Mínimo 1 fileira').max(MAX_ROWS, `Máximo ${MAX_ROWS} fileiras`),
  seatsPerRow: z
    .number()
    .int()
    .min(1, 'Mínimo 1 assento por fileira')
    .max(MAX_SEATS_PER_ROW, `Máximo ${MAX_SEATS_PER_ROW} assentos por fileira`),
  priceInReais: z.number().min(0, 'Preço não pode ser negativo'),
})

export type VenueStepValues = z.infer<typeof venueStepSchema>
export type RoomStepValues = z.infer<typeof roomStepSchema>

// Campos editáveis fora do wizard (gestão da sessão) -- mesmos que o back aceita em
// PATCH /events/:id, exceto os que ficam bloqueados após venda (ver EventEditForm.tsx).
export const editEventSchema = z.object({
  venueName: z.string().trim().min(1, 'Local obrigatório').max(200),
  venueState: venueStateSchema,
  venueCity: z.string().trim().min(1, 'Cidade obrigatória').max(100),
  synopsis: z.string().max(2000).optional(),
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().min(1, 'Horário obrigatório'),
  timezone: z.string().refine(isValidIanaTimezone, 'Fuso horário inválido'),
  priceInReais: z.number().min(0, 'Preço não pode ser negativo'),
})

export type EditEventValues = z.infer<typeof editEventSchema>
