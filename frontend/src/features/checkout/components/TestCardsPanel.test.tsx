import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.doUnmock('../../../lib/env')
  vi.resetModules()
})

async function renderWithKey(publishableKey: string) {
  vi.doMock('../../../lib/env', () => ({ env: { VITE_STRIPE_PUBLISHABLE_KEY: publishableKey } }))
  const { TestCardsPanel } = await import('./TestCardsPanel')
  return render(<TestCardsPanel />)
}

describe('TestCardsPanel', () => {
  it('aparece com uma chave pk_test_ -- números sempre visíveis, sem interação extra', async () => {
    await renderWithKey('pk_test_abc123')

    expect(screen.getByText('4242 4242 4242 4242')).toBeInTheDocument()
    expect(screen.getByText('4000 0025 0000 3155')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Copiar' })).toHaveLength(4)
  })

  it('some com uma chave pk_live_ -- nunca mostra cartões de teste em produção real', async () => {
    const { container } = await renderWithKey('pk_live_abc123')

    expect(container).toBeEmptyDOMElement()
  })
})
