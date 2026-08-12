import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimezonePicker } from './TimezonePicker'

describe('TimezonePicker', () => {
  it('sem data ou hora preenchidas, não mostra a linha de confirmação', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} date="" time="" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mostra o horário correto no fuso escolhido -- Manaus (UTC-4, sem horário de verão)', () => {
    render(<TimezonePicker value="America/Manaus" onChange={vi.fn()} date="2026-08-20" time="21:00" />)
    expect(screen.getByRole('status')).toHaveTextContent('Sessão às 21:00 no horário de Manaus (01:00 UTC)')
  })

  it('trocar o fuso (mesma data/hora) recalcula a linha de confirmação a partir do fuso, não do fuso da máquina', () => {
    const { rerender } = render(
      <TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} date="2026-08-20" time="21:00" />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Sessão às 21:00 no horário de Brasília (00:00 UTC)')

    rerender(<TimezonePicker value="America/Noronha" onChange={vi.fn()} date="2026-08-20" time="21:00" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sessão às 21:00 no horário de Fernando de Noronha (23:00 UTC)',
    )
  })
})
