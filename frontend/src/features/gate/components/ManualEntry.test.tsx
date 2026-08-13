import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ManualEntry } from './ManualEntry'

describe('ManualEntry', () => {
  it('normaliza espaços/quebras de linha (trim) antes de enviar', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ManualEntry disabled={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Código do ingresso'), '  TKT1.abc.def  ')
    await user.click(screen.getByRole('button', { name: 'Validar' }))

    expect(onSubmit).toHaveBeenCalledWith('TKT1.abc.def')
  })

  it('Enter no campo já valida, sem precisar clicar no botão', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ManualEntry disabled={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Código do ingresso'), 'TKT1.abc.def{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('TKT1.abc.def')
  })

  it('limpa o campo depois de enviar', async () => {
    const user = userEvent.setup()
    render(<ManualEntry disabled={false} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText('Código do ingresso')
    await user.type(input, 'TKT1.abc.def{Enter}')

    expect(input).toHaveValue('')
  })

  it('vazio ou só espaço -- não chama onSubmit', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ManualEntry disabled={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Código do ingresso'), '   {Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disabled -- campo e botão desabilitados (câmera/manual compartilham o mesmo "busy")', () => {
    render(<ManualEntry disabled={true} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Código do ingresso')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar' })).toBeDisabled()
  })
})
