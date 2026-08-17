import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import styles from './GateScanner.module.css'

interface GateScannerProps {
  paused: boolean
  onScan: (code: string) => void
}

type CameraState = 'starting' | 'ready' | 'insecure' | 'unavailable'

export function GateScanner({ paused, onScan }: GateScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedRef = useRef(paused)
  const onScanRef = useRef(onScan)
  const [cameraState, setCameraState] = useState<CameraState>(() =>
    window.isSecureContext ? 'starting' : 'insecure',
  )

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!window.isSecureContext) return

    let cancelled = false
    let controls: IScannerControls | null = null
    const reader = new BrowserQRCodeReader()

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current ?? undefined, (result) => {
        if (!result || pausedRef.current) return
        onScanRef.current(result.getText())
      })
      .then((c) => {
        if (cancelled) {
          c.stop()
          return
        }
        controls = c
        setCameraState('ready')
      })
      .catch(() => {
        if (!cancelled) setCameraState('unavailable')
      })

    return () => {
      cancelled = true
      controls?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (cameraState === 'insecure') {
    return (
      <p className={styles.notice} role="status">
        Leitura por câmera exige conexão segura (HTTPS); use a digitação manual abaixo.
      </p>
    )
  }

  if (cameraState === 'unavailable') {
    return (
      <p className={styles.notice} role="status">
        Não foi possível acessar a câmera - confira a permissão nas configurações do
        navegador e recarregue a página. A digitação manual abaixo continua funcionando.
      </p>
    )
  }

  return (
    <div className={styles.wrapper}>
      <video ref={videoRef} className={styles.video} muted playsInline aria-label="Câmera da portaria" />
      {cameraState === 'starting' && <p className={styles.starting}>Iniciando câmera...</p>}
    </div>
  )
}
