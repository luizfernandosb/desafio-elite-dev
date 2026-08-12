import { createContext, useContext } from 'react'

export type ToastVariant = 'default' | 'success' | 'danger'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

// Separado de Toast.tsx -- um arquivo que só exporta componente mantém o Fast
// Refresh funcionando; hook + tipos aqui, `ToastProvider` lá.
export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
