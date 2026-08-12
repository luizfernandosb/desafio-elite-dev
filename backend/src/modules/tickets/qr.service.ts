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

export interface DecodedTicketCode {
  ticketId: string
  eventId: string
  jti: string
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

// única checagem de formato + assinatura, compartilhada por verifyTicketCode (sabe o
// que espera encontrar) e parseAndVerifyTicketCode (não sabe -- é a portaria que decide
// o que fazer com o payload decodificado). Nunca lança.
function decodeAndVerify(code: string): DecodedTicketCode | null {
  try {
    const parts = code.split('.')
    if (parts.length !== 3) return null

    const [version, payloadB64, sig] = parts as [string, string, string]
    if (version !== VERSION) return null

    const expectedSigBuf = Buffer.from(sign(payloadB64), 'base64url')
    const sigBuf = Buffer.from(sig, 'base64url')
    if (sigBuf.length !== expectedSigBuf.length || !timingSafeEqual(sigBuf, expectedSigBuf)) {
      return null
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TicketCodePayload
    return { ticketId: payload.t, eventId: payload.e, jti: payload.j }
  } catch {
    return null
  }
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
  return { code, codeHash: hashTicketCode(code), jti }
}

// recomputa o código a partir do que está guardado (ticketId, eventId, qrJti) -- usado
// por GET /tickets/:id (etapa 08). O código em claro nunca é persistido.
export function deriveTicketCode(input: { ticketId: string; eventId: string; jti: string }): string {
  return buildCode({ t: input.ticketId, e: input.eventId, j: input.jti })
}

export function hashTicketCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

// nunca lança -- formato inválido, prefixo desconhecido, assinatura errada ou
// ticketId/eventId diferente do esperado tudo vira `false` (§7.10.4, teste nº 4)
export function verifyTicketCode(code: string, expected: { ticketId: string; eventId: string }): boolean {
  const decoded = decodeAndVerify(code)
  return decoded !== null && decoded.ticketId === expected.ticketId && decoded.eventId === expected.eventId
}

// passo 1 da portaria (§7.6): confirma formato + assinatura em CPU, sem tocar o banco,
// e devolve o payload decodificado -- ao contrário de verifyTicketCode, não recebe (e
// não precisa saber) qual ticketId/eventId esperar. É a portaria que decide o que fazer
// com o eventId decodificado (comparar contra o evento do posto = passo 3).
export function parseAndVerifyTicketCode(code: string): DecodedTicketCode | null {
  return decodeAndVerify(code)
}
