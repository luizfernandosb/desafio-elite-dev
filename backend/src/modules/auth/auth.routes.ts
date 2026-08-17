import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/env'
import { requireAuth } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { RateLimitedError } from '../../shared/errors'
import { AuthController } from './auth.controller'
import { googleSchema, loginSchema, registerSchema } from './auth.schema'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { GoogleAuthProvider } from './google.service'

const authRepository = new AuthRepository()
const googleProvider = new GoogleAuthProvider()
const authService = new AuthService(authRepository, googleProvider)
const authController = new AuthController(authService)

const skipInTest = () => env.NODE_ENV === 'test'

const rateLimitHandler = (_req: unknown, _res: unknown, next: (err: unknown) => void) =>
  next(new RateLimitedError())

const perIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: rateLimitHandler,
})

const perEmailLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email ?? '').trim().toLowerCase() || 'unknown',
  skip: skipInTest,
  handler: rateLimitHandler,
})

export const authRoutes = Router()

authRoutes.post('/register', perIpLimiter, validate(registerSchema), authController.register)
authRoutes.post(
  '/login',
  perIpLimiter,
  perEmailLoginLimiter,
  validate(loginSchema),
  authController.login,
)
authRoutes.post('/refresh', perIpLimiter, authController.refresh)
authRoutes.post('/logout', requireAuth, authController.logout)
authRoutes.post('/google', perIpLimiter, validate(googleSchema), authController.google)
authRoutes.get('/me', requireAuth, authController.me)
