import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { Logger } from 'pino'
import { logger } from '../lib/logger'

declare global {
  // augmentação de tipos do Express exige `namespace` -- não há alternativa em ES modules
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string
      log: Logger
    }
  }
}

// o path da rota pública de compartilhamento inclui o próprio shareToken
// (/api/v1/share/<token>) -- `url: req.url` sem isso vazaria a credencial em toda
// linha de log da requisição, mesmo com `*.shareToken` no redact (etapa 09)
const SHARE_PATH_RE = /^(\/api\/v1\/share\/)[^/?]+/

export function maskUrl(url: string): string {
  return url.replace(SHARE_PATH_RE, '$1:token')
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID()
  res.setHeader('x-request-id', req.id)

  req.log = logger.child({ requestId: req.id })

  const start = Date.now()
  const url = maskUrl(req.url)

  req.log.info({ msg: 'request received', method: req.method, url })

  res.on('finish', () => {
    const durationMs = Date.now() - start
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'

    req.log[level]({
      msg: 'request completed',
      method: req.method,
      url,
      statusCode: res.statusCode,
      durationMs,
    })
  })

  next()
}
