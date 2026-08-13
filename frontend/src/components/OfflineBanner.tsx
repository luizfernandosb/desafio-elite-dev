import { useEffect, useState } from 'react'
import styles from './OfflineBanner.module.css'

// `navigator.onLine` só dá o ponto de partida (§ etapa 11) -- os eventos `online`/
// `offline` da própria API do navegador mantêm o estado correto depois, sem
// polling. Diferente de erro de servidor: a ação certa aqui é esperar a rede
// voltar, não tentar de novo imediatamente -- por isso um banner fixo, não um
// `ErrorState` com botão de retry.
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className={styles.banner} role="status">
      Sem conexão com a internet -- verifique sua rede. Tentaremos de novo quando ela voltar.
    </div>
  )
}
