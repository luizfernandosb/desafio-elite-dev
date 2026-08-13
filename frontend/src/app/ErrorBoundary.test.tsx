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

  // § etapa 11 -- mapa de assentos, checkout e portaria envolvem só a seção pesada
  // num `<ErrorBoundary>` (nunca a página inteira); este teste prova o motivo:
  // um irmão FORA do boundary sobrevive ao erro de dentro, então o header/nav (que
  // fica fora de qualquer seção) nunca some por causa de um erro no mapa/scanner.
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
