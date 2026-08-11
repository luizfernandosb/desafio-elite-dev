import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { env } from '../../config/env'
import { Role } from '../../../generated/prisma/enums'
import { UnauthorizedError } from '../../shared/errors'
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './token.service'

describe('token.service', () => {
  it('assina e verifica um access token válido', () => {
    const token = signAccessToken({ sub: 'user-1', role: Role.CUSTOMER })
    const payload = verifyAccessToken(token)
    expect(payload.sub).toBe('user-1')
    expect(payload.role).toBe(Role.CUSTOMER)
    expect(payload.jti).toBeDefined()
  })

  it('rejeita access token expirado', () => {
    const expired = jwt.sign({ sub: 'user-1', role: Role.CUSTOMER, jti: 'x' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
    })
    expect(() => verifyAccessToken(expired)).toThrow(UnauthorizedError)
  })

  it('rejeita access token assinado com o segredo de refresh', () => {
    const wrongSecretToken = jwt.sign(
      { sub: 'user-1', role: Role.CUSTOMER, jti: 'x' },
      env.JWT_REFRESH_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' },
    )
    expect(() => verifyAccessToken(wrongSecretToken)).toThrow(UnauthorizedError)
  })

  it('rejeita token com alg: none', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-1', role: Role.CUSTOMER, jti: 'x' }),
    ).toString('base64url')
    const noneToken = `${header}.${payload}.`

    expect(() => verifyAccessToken(noneToken)).toThrow(UnauthorizedError)
  })

  it('assina e verifica um refresh token válido', () => {
    const token = signRefreshToken({ sub: 'user-1', role: Role.ORGANIZER, jti: 'jti-1' })
    const payload = verifyRefreshToken(token)
    expect(payload.sub).toBe('user-1')
    expect(payload.jti).toBe('jti-1')
  })

  it('rejeita refresh token expirado', () => {
    const expired = jwt.sign(
      { sub: 'user-1', role: Role.CUSTOMER, jti: 'x' },
      env.JWT_REFRESH_SECRET,
      { algorithm: 'HS256', expiresIn: -1 },
    )
    expect(() => verifyRefreshToken(expired)).toThrow(UnauthorizedError)
  })

  it('payload não revela nome nem e-mail -- o token é assinado, não criptografado', () => {
    const token = signAccessToken({ sub: 'user-1', role: Role.CUSTOMER })
    const decoded = jwt.decode(token) as Record<string, unknown>

    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'jti', 'role', 'sub'])
  })
})
