import { ApiError } from '../../lib/api'

export function shareErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'TICKET_CANCELLED') return 'Ingresso cancelado não pode ser compartilhado.'
    if (err.code === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde um instante.'
    return err.message
  }
  return 'Não foi possível concluir a operação. Tente de novo.'
}

export function cancelErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_TRANSITION') return 'Este ingresso não pode mais ser cancelado.'
    if (err.code === 'EVENT_ALREADY_STARTED') return 'A sessão já começou -- não é possível cancelar.'
    return err.message
  }
  return 'Não foi possível concluir a operação. Tente de novo.'
}

export function publicShareErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'SHARE_EXPIRED' || err.code === 'SHARE_REVOKED') {
      return 'Este link não está mais disponível.'
    }
    if (err.code === 'SHARE_NOT_FOUND') return 'Link inválido.'
    if (err.code === 'TICKET_CANCELLED') return 'Este ingresso foi cancelado.'
    return err.message
  }
  return 'Não foi possível carregar este ingresso. Tente de novo.'
}
