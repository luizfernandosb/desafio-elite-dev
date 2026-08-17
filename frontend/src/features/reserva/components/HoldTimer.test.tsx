import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HoldTimer } from './HoldTimer'

describe('HoldTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('conta a partir de expiresAt do servidor, não do momento de montagem', () => {
    const expiresAt = new Date('2026-01-01T10:09:30.000Z').toISOString()
    render(<HoldTimer expiresAt={expiresAt} onExpire={vi.fn()} />)

    expect(screen.getByText('9:30')).toBeInTheDocument()
  })

  it('decresce por segundo conforme o relógio avança, não um contador independente', () => {
    const expiresAt = new Date('2026-01-01T10:00:10.000Z').toISOString()
    render(<HoldTimer expiresAt={expiresAt} onExpire={vi.fn()} />)
    expect(screen.getByText('0:10')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('0:07')).toBeInTheDocument()
  })

  it('abaixo de 2 minutos entra no estado de alerta (cor --warning)', () => {
    const expiresAt = new Date('2026-01-01T10:01:50.000Z').toISOString()
    render(<HoldTimer expiresAt={expiresAt} onExpire={vi.fn()} />)

    expect(screen.getByText('1:50').className).toMatch(/warning/)
  })

  it('2 minutos ou mais não está em alerta', () => {
    const expiresAt = new Date('2026-01-01T10:05:00.000Z').toISOString()
    render(<HoldTimer expiresAt={expiresAt} onExpire={vi.fn()} />)

    expect(screen.getByText('5:00').className).not.toMatch(/warning/)
  })

  it('ao chegar a zero, chama onExpire exatamente uma vez', () => {
    const onExpire = vi.fn()
    const expiresAt = new Date('2026-01-01T10:00:02.000Z').toISOString()
    render(<HoldTimer expiresAt={expiresAt} onExpire={onExpire} />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('anuncia "5 minutos restantes" e "1 minuto restante" nos marcos, não a cada segundo', () => {
    const expiresAt = new Date('2026-01-01T10:05:03.000Z').toISOString()
    render(<HoldTimer expiresAt={expiresAt} onExpire={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('5 minutos restantes')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('5 minutos restantes')

    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000 - 1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('1 minuto restante')
  })
})
