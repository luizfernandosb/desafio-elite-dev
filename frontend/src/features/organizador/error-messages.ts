import { ApiError } from '../../lib/api'

// Tratado por `code`, nunca por status (§5.5.4) -- mesmo raciocínio de
// features/auth/error-messages.ts. CATALOG_UNAVAILABLE e CATALOG_RATE_LIMITED levam
// a mesma mensagem: o plano não pede diferenciar (§ etapa 04, passo 1), e nenhum dos
// dois tem ação diferente para o organizador além de tentar de novo mais tarde.
export function catalogErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'CATALOG_UNAVAILABLE' || err.code === 'CATALOG_RATE_LIMITED') {
      return 'Catálogo temporariamente indisponível. Tente de novo em instantes - seu rascunho continua salvo.'
    }
    return err.message
  }
  return 'Não foi possível buscar no catálogo. Tente de novo.'
}

export function eventErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'EVENT_HAS_SALES') return 'Esta sessão já vendeu ingressos - alguns campos ficam bloqueados.'
    if (err.code === 'EVENT_NOT_DELETABLE') return 'Só é possível remover sessões em rascunho, sem ingressos vendidos.'
    if (err.code === 'EVENT_STARTS_IN_PAST') return 'Não é possível publicar uma sessão cuja data já passou.'
    if (err.code === 'INVALID_TRANSITION') return 'Essa ação não é permitida no estado atual da sessão.'
    if (err.code === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde um instante.'
    return err.message
  }
  return 'Não foi possível concluir a ação. Tente de novo.'
}

export function imageErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_IMAGE') return 'Imagem inválida - use JPEG, PNG ou WebP de até 5 MB.'
    return err.message
  }
  return 'Não foi possível enviar a imagem. Tente de novo.'
}
