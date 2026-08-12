import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('digitar rápido dispara só um commit, depois do debounce de 400ms', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar value="" onCommit={onCommit} />)

    await user.type(screen.getByLabelText('Buscar sessão'), 'duna')
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('duna')
  })

  it('sem digitação nenhuma, nenhum commit dispara', async () => {
    const onCommit = vi.fn()
    render(<SearchBar value="" onCommit={onCommit} />)

    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('valor externo (ex.: "limpar filtros" ou F5 com ?q= na URL) sincroniza o campo', () => {
    const onCommit = vi.fn()
    const { rerender } = render(<SearchBar value="duna" onCommit={onCommit} />)
    expect(screen.getByLabelText('Buscar sessão')).toHaveValue('duna')

    rerender(<SearchBar value="" onCommit={onCommit} />)
    expect(screen.getByLabelText('Buscar sessão')).toHaveValue('')
  })
})
