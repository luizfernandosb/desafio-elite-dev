import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword, verifyPasswordConstantTime } from './password.service'

describe('password.service', () => {
  it('o hash nunca é igual à senha em texto puro', async () => {
    const hash = await hashPassword('minha-senha-secreta')
    expect(hash).not.toBe('minha-senha-secreta')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  it('verifyPassword aceita a senha correta e rejeita a errada', async () => {
    const hash = await hashPassword('senha-correta-123')
    expect(await verifyPassword(hash, 'senha-correta-123')).toBe(true)
    expect(await verifyPassword(hash, 'senha-errada-456')).toBe(false)
  })

  it('verifyPasswordConstantTime retorna false quando não há hash (e-mail inexistente ou conta Google)', async () => {
    expect(await verifyPasswordConstantTime(null, 'qualquer-coisa')).toBe(false)
  })

  it('verifyPasswordConstantTime delega para verifyPassword quando há hash', async () => {
    const hash = await hashPassword('senha-correta-123')
    expect(await verifyPasswordConstantTime(hash, 'senha-correta-123')).toBe(true)
    expect(await verifyPasswordConstantTime(hash, 'senha-errada-456')).toBe(false)
  })
})
