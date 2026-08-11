import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { Role } from '../../generated/prisma/enums'
import { signAccessToken } from '../modules/auth/token.service'
import { ForbiddenError, UnauthorizedError } from '../shared/errors'
import { optionalAuth, requireAuth, requireRole } from './auth.middleware'

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request
}

describe('requireAuth', () => {
  it('popula req.user e chama next() sem erro para um token válido', () => {
    const token = signAccessToken({ sub: 'user-1', role: Role.ORGANIZER })
    const req = makeReq({ authorization: `Bearer ${token}` })
    const next = vi.fn()

    requireAuth(req, {} as Response, next)

    expect(req.user).toEqual({ id: 'user-1', role: Role.ORGANIZER })
    expect(next).toHaveBeenCalledWith()
  })

  it('chama next com UnauthorizedError quando não há header', () => {
    const next = vi.fn()
    requireAuth(makeReq(), {} as Response, next)
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))
  })

  it('chama next com UnauthorizedError para token inválido', () => {
    const next = vi.fn()
    requireAuth(makeReq({ authorization: 'Bearer token-forjado' }), {} as Response, next)
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))
  })
})

describe('optionalAuth', () => {
  it('popula req.user quando o token é válido', () => {
    const token = signAccessToken({ sub: 'user-1', role: Role.ORGANIZER })
    const req = makeReq({ authorization: `Bearer ${token}` })
    const next = vi.fn()

    optionalAuth(req, {} as Response, next)

    expect(req.user).toEqual({ id: 'user-1', role: Role.ORGANIZER })
    expect(next).toHaveBeenCalledWith()
  })

  it('segue anônimo (sem erro) quando não há header', () => {
    const req = makeReq()
    const next = vi.fn()

    optionalAuth(req, {} as Response, next)

    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalledWith()
  })

  it('segue anônimo (sem erro) quando o token é inválido', () => {
    const req = makeReq({ authorization: 'Bearer token-forjado' })
    const next = vi.fn()

    optionalAuth(req, {} as Response, next)

    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalledWith()
  })
})

describe('requireRole', () => {
  it('chama next() sem erro quando o papel está na lista', () => {
    const req = { user: { id: 'user-1', role: Role.ORGANIZER } } as Request
    const next = vi.fn()

    requireRole(Role.ORGANIZER, Role.GATE)(req, {} as Response, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('chama next com ForbiddenError quando o papel não está na lista', () => {
    const req = { user: { id: 'user-1', role: Role.CUSTOMER } } as Request
    const next = vi.fn()

    requireRole(Role.ORGANIZER, Role.GATE)(req, {} as Response, next)

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))
  })

  it('chama next com UnauthorizedError quando req.user não existe', () => {
    const req = {} as Request
    const next = vi.fn()

    requireRole(Role.ORGANIZER)(req, {} as Response, next)

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))
  })
})
