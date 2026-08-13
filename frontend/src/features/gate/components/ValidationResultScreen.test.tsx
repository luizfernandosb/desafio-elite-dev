import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GateValidationResponse } from '../api'
import { ValidationResultScreen } from './ValidationResultScreen'

function makeResponse(overrides: Partial<GateValidationResponse> = {}): GateValidationResponse {
  return {
    result: 'VALID',
    ticket: { seat: 'A12', eventTitle: 'Duna: Parte Dois' },
    usedAt: null,
    validatedBy: null,
    message: 'Entrada liberada',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ValidationResultScreen', () => {
  it('VALID -- mensagem, assento e evento, sem sobreposição com outro estado', () => {
    render(<ValidationResultScreen response={makeResponse()} muted onDismiss={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Entrada liberada')
    expect(screen.getByText('Duna: Parte Dois')).toBeInTheDocument()
    expect(screen.getByText('Assento A12')).toBeInTheDocument()
    expect(screen.queryByText(/Validado às/)).not.toBeInTheDocument()
  })

  it.each([
    ['INVALID_SIGNATURE', 'Código inválido'],
    ['NOT_FOUND', 'Ingresso não encontrado'],
    ['CANCELLED_TICKET', 'Ingresso cancelado'],
    ['WRONG_EVENT', 'Ingresso de outro evento'],
    ['GATE_TOO_EARLY', 'Portaria ainda não abriu'],
    ['GATE_CLOSED', 'Evento já encerrado'],
  ] as const)('%s -- mostra a mensagem do back, sem ticket (back nunca envia)', (result, message) => {
    render(
      <ValidationResultScreen
        response={makeResponse({ result, message, ticket: null })}
        muted
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Duna: Parte Dois')).not.toBeInTheDocument()
  })

  it('ALREADY_USED -- mostra quando e quem validou antes', () => {
    render(
      <ValidationResultScreen
        response={makeResponse({
          result: 'ALREADY_USED',
          message: 'Ingresso já utilizado',
          usedAt: '2026-08-13T20:15:00.000Z',
          validatedBy: 'Ana',
        })}
        muted
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText(/Validado às/)).toHaveTextContent('por Ana')
  })

  it('some sozinho depois de ~2s, chamando onDismiss uma única vez', () => {
    const onDismiss = vi.fn()
    render(<ValidationResultScreen response={makeResponse()} muted onDismiss={onDismiss} />)

    vi.advanceTimersByTime(1999)
    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
