import pino from 'pino'
import { env } from '../config/env'

// exportado separado do singleton para que o teste de redact possa reconstruir a
// mesma configuração contra um destino em memória, sem depender de I/O real
export const loggerOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
      : undefined,
  base: { service: 'ticketdev-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.passwordHash',
      'body.cardNumber',
      '*.passwordHash',
      '*.stripePaymentIntentId',
      '*.code', // código do QR em claro -- nunca deveria ser logado (§7.6, etapa 08)
      '*.shareToken',
      'req.params.shareToken', // o path da rota pública inclui o token (etapa 09)
    ],
    censor: '[REDACTED]',
  },
}

export const logger = pino(loggerOptions)
