import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('abre ao clicar no gatilho, Esc fecha e o foco volta ao gatilho', async () => {
    const user = userEvent.setup()
    render(
      <Dialog trigger={<Button>Abrir</Button>} title="Título do dialog">
        <p>Conteúdo</p>
      </Dialog>,
    )

    const trigger = screen.getByRole('button', { name: 'Abrir' })
    await user.click(trigger)

    expect(screen.getByRole('dialog', { name: 'Título do dialog' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('foco preso -- o foco nunca sai do conteúdo do dialog enquanto aberto', async () => {
    const user = userEvent.setup()
    render(
      <Dialog trigger={<Button>Abrir</Button>} title="Título">
        <button type="button">Ação</button>
      </Dialog>,
    )

    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    const dialog = screen.getByRole('dialog')
    // Radix move o foco para dentro do conteúdo ao abrir
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.tab()
    await user.tab()
    await user.tab()

    // depois de qualquer número de Tabs, o foco continua dentro do dialog -- nunca
    // escapa para o resto da página atrás dele
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })
})
