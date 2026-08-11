import { Writable } from 'node:stream'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { loggerOptions } from './logger'

function captureLogLine(fn: (testLogger: pino.Logger) => void): string {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk)
      callback()
    },
  })

  // mesma configuração (redact, base, etc.) do singleton, só troca o destino por
  // memória -- testa a configuração real sem depender de I/O de verdade
  fn(pino(loggerOptions, stream))

  return Buffer.concat(chunks).toString()
}

describe('logger redact', () => {
  it('nunca deixa passar authorization, cookie ou senha em texto puro (§5.5.7)', () => {
    const output = captureLogLine((testLogger) => {
      testLogger.warn({
        msg: 'request received',
        req: { headers: { authorization: 'Bearer super-secret-token', cookie: 'refreshToken=abc' } },
        body: { password: 'senha-do-usuario', passwordHash: '$argon2id$hash' },
      })
    })

    expect(output).not.toContain('super-secret-token')
    expect(output).not.toContain('refreshToken=abc')
    expect(output).not.toContain('senha-do-usuario')
    expect(output).not.toContain('$argon2id$hash')
    expect(output).toContain('[REDACTED]')
  })
})
