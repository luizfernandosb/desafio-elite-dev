import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env'

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

export function generateTicketCode(input: { ticketId: string; eventId: string }): {
  code: string
  codeHash: string
  jti: string
} {
  const jti = randomBytes(32).toString('base64url')
  const code = buildCode({ t: input.ticketId, e: input.eventId, j: jti })
  return { code, codeHash: hashTicketCode(code), jti }
}

export function deriveTicketCode(input: { ticketId: string; eventId: string; jti: string }): string {
  return buildCode({ t: input.ticketId, e: input.eventId, j: input.jti })
}

export function hashTicketCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function verifyTicketCode(code: string, expected: { ticketId: string; eventId: string }): boolean {
  const decoded = decodeAndVerify(code)
  return decoded !== null && decoded.ticketId === expected.ticketId && decoded.eventId === expected.eventId
}

export function parseAndVerifyTicketCode(code: string): DecodedTicketCode | null {
  return decodeAndVerify(code)
}
