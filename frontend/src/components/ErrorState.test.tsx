import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import { ToastProvider } from './Toast'
import { ErrorState } from './ErrorState'

function renderError(error: unknown, onRetry?: () => void) {
  return render(
    <ToastProvider>
      <ErrorState error={error} onRetry={onRetry} />
    </ToastProvider>,
  )
}

describe('ErrorState', () => {
  it('NOT_FOUND -- título e mensagem certos, sem botão de retry', () => {
    renderError(new ApiError('NOT_FOUND', 'Ingresso não encontrado', 404), vi.fn())

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Não encontrado')
    expect(alert).toHaveTextContent('Ingresso não encontrado')
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('NETWORK_ERROR -- "Sem conexão" com retry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    renderError(new ApiError('NETWORK_ERROR', 'Sem conexão com o servidor. Verifique sua internet.', 0), onRetry)

    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('sem onRetry -- mesmo um código com retry não mostra o botão (nada para chamar)', () => {
    renderError(new ApiError('TIMEOUT', 'A operação demorou mais que o esperado.', 0))

    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('requestId presente -- copiável, mostra toast de confirmação ao copiar', async () => {
    // `userEvent.setup()` já stuba `navigator.clipboard` sozinho (docs/bugs.md #23) --
    // ler de volta com `readText()` em vez de espionar uma implementação própria
    const user = userEvent.setup()
    renderError(new ApiError('INTERNAL_ERROR', 'Erro interno', 500, 'req-abc123'))

    expect(screen.getByText('req-abc123')).toBeInTheDocument()
    await user.click(screen.getByText(/Código de referência/))

    expect(await navigator.clipboard.readText()).toBe('req-abc123')
    expect(await screen.findByText('Código copiado.')).toBeInTheDocument()
  })

  it('sem requestId -- nada de código de referência na tela', () => {
    renderError(new ApiError('INTERNAL_ERROR', 'Erro interno', 500))

    expect(screen.queryByText(/Código de referência/)).not.toBeInTheDocument()
  })
})
