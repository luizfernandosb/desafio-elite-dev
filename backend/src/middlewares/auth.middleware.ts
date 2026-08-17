import type { NextFunction, Request, Response } from 'express'
import type { Role } from '../../generated/prisma/enums'
import { verifyAccessToken } from '../modules/auth/token.service'
import { ForbiddenError, UnauthorizedError } from '../shared/errors'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role }
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token ausente'))
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, role: payload.role }
    next()
  } catch (err) {
    next(err)
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice('Bearer '.length))
      req.user = { id: payload.sub, role: payload.role }
    } catch {}
  }

  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError('Token ausente'))
    if (!roles.includes(req.user.role)) return next(new ForbiddenError())
    next()
  }
}
