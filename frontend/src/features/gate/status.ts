import type { ValidationResult } from './api'

export type ResultTone = 'valid' | 'invalid' | 'used' | 'neutral'

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
