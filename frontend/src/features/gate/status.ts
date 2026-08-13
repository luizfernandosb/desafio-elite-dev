import type { ValidationResult } from './api'

export type ResultTone = 'valid' | 'invalid' | 'used' | 'neutral'

// Os quatro blocos oficiais do plano (§5.1.1) mais os dois de janela de tempo, que o
// próprio plano manda tratar com "a cor neutra de evento errado". `NOT_FOUND` e
// `CANCELLED_TICKET` não têm bloco próprio no desenho -- caem no mesmo vermelho de
// `INVALID_SIGNATURE` porque, do ponto de vista de quem está na catraca, os três
// significam a mesma coisa: este código não abre a porta.
const TONE_BY_RESULT: Record<ValidationResult, ResultTone> = {
  VALID: 'valid',
  INVALID_SIGNATURE: 'invalid',
  NOT_FOUND: 'invalid',
  CANCELLED_TICKET: 'invalid',
  ALREADY_USED: 'used',
  WRONG_EVENT: 'neutral',
  GATE_TOO_EARLY: 'neutral',
  GATE_CLOSED: 'neutral',
}

// Símbolos simples (mesmo padrão do "✕" do Dialog/Toast, § etapa 02) -- sem
// biblioteca de ícones no projeto.
const ICON_BY_TONE: Record<ResultTone, string> = {
  valid: '✓',
  invalid: '✕',
  used: '⚠',
  neutral: '⊘',
}

export function resultTone(result: ValidationResult): ResultTone {
  return TONE_BY_RESULT[result]
}

export function resultIcon(result: ValidationResult): string {
  return ICON_BY_TONE[resultTone(result)]
}
