import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SeatMap, type SeatMapRow } from './SeatMap'

function buildRows(): SeatMapRow[] {
  return [
    {
      row: 'A',
      seats: [
        { label: 'A1', status: 'FREE' },
        { label: 'A2', status: 'SOLD' },
        { label: 'A3', status: 'FREE' },
      ],
    },
    {
      row: 'B',
      seats: [
        { label: 'B1', status: 'HELD' },
        { label: 'B2', status: 'FREE' },
        { label: 'B3', status: 'FREE' },
      ],
    },
  ]
}

describe('SeatMap', () => {
  it('renderiza a estrutura de grid com role e aria-* corretos', () => {
    render(<SeatMap rows={buildRows()} onSeatClick={vi.fn()} ariaLabel="Mapa de assentos -- Cine Elite" />)

    const grid = screen.getByRole('grid', { name: 'Mapa de assentos -- Cine Elite' })
    expect(grid).toHaveAttribute('aria-rowcount', '2')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('rowheader', { name: 'A' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(6)
  })

  it('assento vendido/reservado não é tabIndex=0 -- não é parada de Tab', () => {
    render(<SeatMap rows={buildRows()} onSeatClick={vi.fn()} />)

    expect(screen.getByLabelText('Assento A2, vendido')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByLabelText('Assento B1, reservado por outro usuário')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByLabelText('Assento A1, disponível')).toHaveAttribute('tabindex', '0')
  })

  it('setas movem o foco entre células adjacentes, inclusive por cima de um assento vendido', async () => {
    const user = userEvent.setup()
    render(<SeatMap rows={buildRows()} onSeatClick={vi.fn()} />)

    const a1 = screen.getByLabelText('Assento A1, disponível')
    a1.focus()
    expect(a1).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByLabelText('Assento A2, vendido')).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByLabelText('Assento A3, disponível')).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByLabelText('Assento B3, disponível')).toHaveFocus()
  })

  it('Enter/Espaço seleciona um assento livre, mas não faz nada em vendido/reservado', async () => {
    const onSeatClick = vi.fn()
    const user = userEvent.setup()
    render(<SeatMap rows={buildRows()} onSeatClick={onSeatClick} />)

    const a1 = screen.getByLabelText('Assento A1, disponível')
    a1.focus()
    await user.keyboard('{Enter}')
    expect(onSeatClick).toHaveBeenCalledWith('A1')

    onSeatClick.mockClear()
    const a2 = screen.getByLabelText('Assento A2, vendido')
    a2.focus()
    await user.keyboard(' ')
    expect(onSeatClick).not.toHaveBeenCalled()
  })

  it('modo leitura (sem onSeatClick) -- nenhuma célula é parada de Tab', () => {
    render(<SeatMap rows={buildRows()} />)
    for (const cell of screen.getAllByRole('gridcell')) {
      expect(cell).toHaveAttribute('tabindex', '-1')
    }
  })

  it('modo projeto (sem status) -- clique sempre disponível, usa aria-pressed em vez de aria-selected', () => {
    const onSeatClick = vi.fn()
    render(
      <SeatMap
        rows={[{ row: 'A', seats: [{ label: 'A1', accessible: true }, { label: 'A2' }] }]}
        onSeatClick={onSeatClick}
      />,
    )

    const a1 = screen.getByLabelText('Assento A1, acessível')
    expect(a1).toHaveAttribute('tabindex', '0')
    expect(a1).toHaveAttribute('aria-pressed', 'true')
    expect(a1).not.toHaveAttribute('aria-selected')
  })
})
