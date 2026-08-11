import type { Request, Response } from 'express'
import { env } from '../../config/env'
import { UnauthorizedError } from '../../shared/errors'
import type { AuthService } from './auth.service'

const REFRESH_COOKIE = 'refreshToken'

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response) => {
    const session = await this.authService.register(req.body, req.log)
    setRefreshCookie(res, session.refreshToken)
    res.status(201).json({ accessToken: session.accessToken, user: session.user })
  }

  login = async (req: Request, res: Response) => {
    const session = await this.authService.login(req.body, req.log)
    setRefreshCookie(res, session.refreshToken)
    res.json({ accessToken: session.accessToken, user: session.user })
  }

  google = async (req: Request, res: Response) => {
    const session = await this.authService.loginWithGoogle(req.body, req.log)
    setRefreshCookie(res, session.refreshToken)
    res.json({ accessToken: session.accessToken, user: session.user })
  }

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) throw new UnauthorizedError('Sessão ausente')

    const session = await this.authService.refresh(token, req.log)
    setRefreshCookie(res, session.refreshToken)
    res.json({ accessToken: session.accessToken })
  }

  logout = async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE]
    await this.authService.logout(token, req.log)
    clearRefreshCookie(res)
    res.status(204).send()
  }

  me = async (req: Request, res: Response) => {
    const user = await this.authService.getMe(req.user!.id)
    res.json(user)
  }
}
