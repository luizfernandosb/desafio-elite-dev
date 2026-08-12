import { ApiError } from '../../lib/api'

// SEAT_TAKEN nunca vira uma mensagem genérica (§ etapa 06) -- é o momento em que o
// requisito BE-4 (anti-double-booking) se torna visível para um humano. O ajuste da
// seleção em si (usando `takenSeatIds`) é feito por quem chama `useHold`, não aqui --
// esta função só traduz o `code` em texto.
export function holdErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'SEAT_TAKEN') {
      const takenCount = Array.isArray(err.details?.takenSeatIds) ? err.details.takenSeatIds.length : 1
      return `Alguém reservou ${takenCount === 1 ? 'um destes assentos' : `${takenCount} destes assentos`} primeiro. Escolha outro.`
    }
    if (err.code === 'HOLD_LIMIT_EXCEEDED') return 'Limite de 6 assentos reservados por sessão.'
    if (err.code === 'EVENT_NOT_PUBLISHED') return 'Esta sessão não está mais disponível para reserva.'
    if (err.code === 'SEAT_NOT_IN_EVENT') return 'Assento inválido para esta sessão. Atualize a página.'
    if (err.code === 'FORBIDDEN') return 'Só clientes podem reservar assentos.'
    if (err.code === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde um instante.'
    return err.message
  }
  return 'Não foi possível reservar os assentos. Tente de novo.'
}

export function seatmapErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Não foi possível carregar o mapa de assentos. Tente de novo.'
}
