import pino from 'pino'
import { env } from '../config/env'

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
      '*.code',
      '*.shareToken',
      'req.params.shareToken',
    ],
    censor: '[REDACTED]',
  },
}

export const logger = pino(loggerOptions)
