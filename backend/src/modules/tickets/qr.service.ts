import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env'

// TKT1.<payload-b64url>.<sig-b64url>
// payload = { t: ticketId, e: eventId, j: jti } -- jti de 32 bytes aleatórios (§7.6)
const VERSION = 'TKT1'

interface TicketCodePayload {
  t: string
  e: string
  j: string
}

function sign(payloadB64: string): string {
  return createHmac('sha256', env.JWT_QR_SECRET).update(`${VERSION}.${payloadB64}`).digest('base64url')
}

function encodePayload(payload: TicketCodePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function buildCode(payload: TicketCodePayload): string {
  const payloadB64 = encodePayload(payload)
  return `${VERSION}.${payloadB64}.${sign(payloadB64)}`
}

// `jti` sai junto porque precisa ser persistido (Ticket.qrJti) para o código poder ser
// recalculado depois -- o desvio do retorno `{ code, codeHash }` do plano original é
// deliberado, registrado no README junto das outras inconsistências resolvidas.
export function generateTicketCode(input: { ticketId: string; eventId: string }): {
  code: string
  codeHash: string
  jti: string
} {
  const jti = randomBytes(32).toString('base64url')
  const code = buildCode({ t: input.ticketId, e: input.eventId, j: jti })
  const codeHash = createHash('sha256').update(code).digest('hex')
  return { code, codeHash, jti }
}

// recomputa o código a partir do que está guardado (ticketId, eventId, qrJti) -- usado
// por GET /tickets/:id (etapa 08). O código em claro nunca é persistido.
export function deriveTicketCode(input: { ticketId: string; eventId: string; jti: string }): string {
  return buildCode({ t: input.ticketId, e: input.eventId, j: input.jti })
}

// nunca lança -- formato inválido, prefixo desconhecido, assinatura errada ou
// ticketId/eventId diferente do esperado tudo vira `false` (§7.10.4, teste nº 4)
export function verifyTicketCode(code: string, expected: { ticketId: string; eventId: string }): boolean {
  try {
    const parts = code.split('.')
    if (parts.length !== 3) return false

    const [version, payloadB64, sig] = parts as [string, string, string]
    if (version !== VERSION) return false

    const expectedSigBuf = Buffer.from(sign(payloadB64), 'base64url')
    const sigBuf = Buffer.from(sig, 'base64url')
    if (sigBuf.length !== expectedSigBuf.length || !timingSafeEqual(sigBuf, expectedSigBuf)) {
      return false
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TicketCodePayload
    return payload.t === expected.ticketId && payload.e === expected.eventId
  } catch {
    return false
  }
}
