import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { env } from '../../lib/env'
import { useAuth } from './useAuth'

interface GoogleLoginButtonProps {
  onError?: (message: string) => void
}

// Corte nº 1 do plano (§12.1) -- atrás de VITE_GOOGLE_CLIENT_ID. Sem a variável, este
// componente não renderiza nada (nem o provider do Google); remover a feature de
// verdade custa apagar este arquivo e a variável de ambiente, nada mais depende disso.
//
// Botão oficial do Google, sem retematizar (§ etapa 03) -- são as diretrizes de marca
// deles, e é o único componente da UI que não segue o design system da etapa 02 --
// de propósito, não inconsistência.
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
          // o back verifica o credential e devolve os JWTs próprios -- o token do
          // Google não circula como credencial da API depois disso (§7.3)
          loginWithGoogle(credentialResponse.credential).catch(() => {
            onError?.('Não foi possível entrar com o Google.')
          })
        }}
        onError={() => onError?.('Não foi possível entrar com o Google.')}
      />
    </GoogleOAuthProvider>
  )
}
