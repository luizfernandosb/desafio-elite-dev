import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, RouteErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('bum')
}

describe('ErrorBoundary', () => {
  it('captura erro de render e mostra o fallback, não tela branca', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('bum')
  })

  it('erro isolado por seção -- um irmão fora do boundary sobrevive, nunca propaga para a página inteira', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <div>
        <header>Cabeçalho da aplicação</header>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
        <footer>Resto da página</footer>
      </div>,
    )

    expect(screen.getByText('Cabeçalho da aplicação')).toBeInTheDocument()
    expect(screen.getByText('Resto da página')).toBeInTheDocument()
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
