import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env'
import { AppError } from '../shared/errors'
import { isUniqueViolation } from '../shared/prisma-errors'

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    req.log.warn({ msg: 'business error', code: err.code, statusHint: err.statusHint })
    return res.status(err.statusHint).json({ code: err.code, message: err.message, ...err.details })
  }

  if (isUniqueViolation(err)) {
    req.log.warn({ msg: 'unique constraint violation', meta: err.meta })
    return res.status(409).json({ code: 'CONFLICT', message: 'Recurso já existe ou em conflito' })
  }

  req.log.error({ msg: 'unhandled error', err })

  const isProd = env.NODE_ENV === 'production'
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: isProd ? 'Erro interno' : (err as Error).message,
    requestId: req.id,
  })
}
