import { ApiError } from '../../lib/api'

// Erro de listagem/detalhe do ingresso não tem mais função própria aqui -- vira
// `ErrorState` central (§ etapa 11, `shared/errors.ts`), igual a qualquer outra
// tela. As duas funções abaixo continuam locais porque `TICKET_CANCELLED`/
// `SHARE_*` são negócio (compartilhamento), não infraestrutura.
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

// Página pública (§7.7) -- nunca mostra código técnico nem JSON cru, sempre texto
// humano. 410 (expirado/revogado) e 404 (nunca existiu) viram a mesma explicação de
// "link inválido" só quando não dá pra distinguir; aqui dá, e o back distingue de
// propósito (README, "410 não 404"), então a mensagem também distingue.
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
