import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('clique normal dispara onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Enviar</Button>)

    await user.click(screen.getByRole('button', { name: /enviar/i }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled não dispara onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button disabled onClick={onClick}>
        Enviar
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: /enviar/i }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading mostra spinner, bloqueia o clique e marca aria-busy', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button loading onClick={onClick}>
        Enviar
      </Button>,
    )

    const button = screen.getByRole('button', { name: /enviar/i })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument() // Spinner

    await user.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })
})
