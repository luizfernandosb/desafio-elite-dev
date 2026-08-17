import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { env } from '../../lib/env'
import { useAuth } from './useAuth'

interface GoogleLoginButtonProps {
  onError?: (message: string) => void
}

export function GoogleLoginButton({ onError }: GoogleLoginButtonProps) {
  const { loginWithGoogle } = useAuth()

  if (!env.VITE_GOOGLE_CLIENT_ID) return null

  return (
    <GoogleOAuthProvider clientId={env.VITE_GOOGLE_CLIENT_ID}>
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (!credentialResponse.credential) {
            onError?.('Não foi possível entrar com o Google.')
            return
          }
          loginWithGoogle(credentialResponse.credential).catch(() => {
            onError?.('Não foi possível entrar com o Google.')
          })
        }}
        onError={() => onError?.('Não foi possível entrar com o Google.')}
      />
    </GoogleOAuthProvider>
  )
}
