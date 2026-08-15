import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DateRangeFilter } from './DateRangeFilter'

describe('DateRangeFilter', () => {
  it('alterar "De" preserva o "Até" atual no callback', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DateRangeFilter from="" to="2026-09-01" onChange={onChange} />)

    await user.type(screen.getByLabelText('De'), '2026-08-20')

    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-08-20', to: '2026-09-01' })
  })

  it('alterar "Até" preserva o "De" atual no callback', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DateRangeFilter from="2026-08-20" to="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Até'), '2026-09-01')

    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-08-20', to: '2026-09-01' })
  })

  it('reflete os valores recebidos por fora (ex.: "limpar filtros")', () => {
    const { rerender } = render(<DateRangeFilter from="2026-08-20" to="2026-09-01" onChange={vi.fn()} />)
    expect(screen.getByLabelText('De')).toHaveValue('2026-08-20')
    expect(screen.getByLabelText('Até')).toHaveValue('2026-09-01')

    rerender(<DateRangeFilter from="" to="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('De')).toHaveValue('')
    expect(screen.getByLabelText('Até')).toHaveValue('')
  })
})
