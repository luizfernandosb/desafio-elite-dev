import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { Role } from '../../../generated/prisma/enums'
import { UnauthorizedError } from '../../shared/errors'

export interface AccessTokenPayload {
  sub: string
  role: Role
  jti: string
}

export interface RefreshTokenPayload {
  sub: string
  role: Role
  jti: string
}

export function signAccessToken(payload: { sub: string; role: Role }): string {
  return jwt.sign({ sub: payload.sub, role: payload.role, jti: randomUUID() }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado')
  }
}

export function signRefreshToken(payload: { sub: string; role: Role; jti: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: '7d' })
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    }) as RefreshTokenPayload
  } catch {
    throw new UnauthorizedError('Sessão inválida')
  }
}
