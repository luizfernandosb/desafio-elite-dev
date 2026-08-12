import { describe, expect, it, vi } from 'vitest'
import { deriveTicketCode, generateTicketCode, verifyTicketCode } from './qr.service'

describe('QR -- não forjável (§7.10.4, teste nº 4)', () => {
  it('código gerado é verificado com sucesso', () => {
    const { code } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    expect(verifyTicketCode(code, { ticketId: 't-1', eventId: 'e-1' })).toBe(true)
  })

  it('código adulterado é rejeitado', () => {
    const { code } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const tampered = `${code.slice(0, -4)}XXXX`
    expect(verifyTicketCode(tampered, { ticketId: 't-1', eventId: 'e-1' })).toBe(false)
  })

  it('código válido para evento errado é rejeitado', () => {
    const { code } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    expect(verifyTicketCode(code, { ticketId: 't-1', eventId: 'e-OUTRO' })).toBe(false)
  })

  it('código válido para ticketId errado é rejeitado', () => {
    const { code } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    expect(verifyTicketCode(code, { ticketId: 't-OUTRO', eventId: 'e-1' })).toBe(false)
  })

  it('dois ingressos diferentes geram códigos (e hashes) diferentes', () => {
    const a = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const b = generateTicketCode({ ticketId: 't-2', eventId: 'e-1' })
    expect(a.code).not.toBe(b.code)
    expect(a.codeHash).not.toBe(b.codeHash)
    expect(a.jti).not.toBe(b.jti)
  })

  it('payload reescrito com a assinatura antiga é rejeitado', () => {
    const { code } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const [version, , sig] = code.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ t: 't-2', e: 'e-1', j: 'jti-forjado' })).toString(
      'base64url',
    )
    const forged = `${version}.${forgedPayload}.${sig}`
    expect(verifyTicketCode(forged, { ticketId: 't-2', eventId: 'e-1' })).toBe(false)
  })

  it.each([
    ['string vazia', ''],
    ['prefixo desconhecido', 'TKT9.abc.def'],
    ['sem os três segmentos', 'TKT1.abc'],
    ['base64 inválido no payload', 'TKT1.%%%nao-e-base64%%%.assinatura'],
  ])('%s -- rejeitado, nunca lança', (_label, malformed) => {
    expect(() => verifyTicketCode(malformed, { ticketId: 't-1', eventId: 'e-1' })).not.toThrow()
    expect(verifyTicketCode(malformed, { ticketId: 't-1', eventId: 'e-1' })).toBe(false)
  })

  it('deriveTicketCode reconstrói exatamente o mesmo código a partir do jti guardado', () => {
    const { code, jti } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const derived = deriveTicketCode({ ticketId: 't-1', eventId: 'e-1', jti })
    expect(derived).toBe(code)
  })

  it('trocar o segredo de assinatura invalida um código já emitido', async () => {
    const { code } = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const originalSecret = process.env.JWT_QR_SECRET

    try {
      vi.resetModules()
      process.env.JWT_QR_SECRET = 'outro-segredo-completamente-diferente-32-chars'
      const { verifyTicketCode: verifyWithOtherSecret } = await import('./qr.service')

      expect(verifyWithOtherSecret(code, { ticketId: 't-1', eventId: 'e-1' })).toBe(false)
    } finally {
      process.env.JWT_QR_SECRET = originalSecret
      vi.resetModules()
    }
  })
})
