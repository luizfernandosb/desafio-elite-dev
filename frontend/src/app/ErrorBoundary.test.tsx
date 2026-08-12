import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, RouteErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('bum')
}

describe('ErrorBoundary', () => {
  it('captura erro de render e mostra o fallback, não tela branca', () => {
    // React sempre loga o erro capturado no console, mesmo com um boundary tratando
    // -- silenciado aqui para o output do teste não parecer uma falha
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('bum')
  })
})

describe('RouteErrorBoundary', () => {
  it('erro numa rota (ex.: /portaria) aciona o errorElement, não derruba a aplicação', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const router = createMemoryRouter(
      [
        {
          path: '/',
          errorElement: <RouteErrorBoundary />,
          children: [{ path: 'portaria', element: <Boom /> }],
        },
      ],
      { initialEntries: ['/portaria'] },
    )

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('alert')).toHaveTextContent('bum')
  })
})
