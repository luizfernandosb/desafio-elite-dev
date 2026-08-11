import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env'
import { UnauthorizedError } from '../../shared/errors'

export interface GoogleProfile {
  sub: string
  email: string
  emailVerified: boolean
  name: string
}

// Interface isolada por decisão (§7.3, §12.1) -- Google Sign-In é o primeiro item da
// ordem de corte. Removê-lo custa trocar quem implementa isto, não reescrever o Service.
export interface SocialAuthProvider {
  verify(idToken: string): Promise<GoogleProfile>
}

const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

export class GoogleAuthProvider implements SocialAuthProvider {
  private readonly client = new OAuth2Client(env.GOOGLE_CLIENT_ID)

  async verify(idToken: string): Promise<GoogleProfile> {
    const ticket = await this.client
      .verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID })
      .catch(() => {
        throw new UnauthorizedError('Credencial do Google inválida')
      })

    const payload = ticket.getPayload()

    if (!payload?.sub || !payload.email || !payload.iss || !VALID_ISSUERS.includes(payload.iss)) {
      throw new UnauthorizedError('Credencial do Google inválida')
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      name: payload.name ?? payload.email,
    }
  }
}
