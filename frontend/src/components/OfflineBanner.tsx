import { useEffect, useState } from 'react'
import styles from './OfflineBanner.module.css'

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
      Sem conexão com a internet - verifique sua rede. Tentaremos de novo quando ela voltar.
    </div>
  )
}
