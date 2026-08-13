import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

interface FallbackProps {
  message: string
  onRetry?: () => void
}

// Sem design system ainda (etapa 02) -- marcação semântica mínima, sem classe. O
// objetivo aqui é nunca deixar o usuário numa tela branca, não ser bonito.
function ErrorFallback({ message, onRetry }: FallbackProps) {
  return (
    <div role="alert">
      <h1>Algo deu errado</h1>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Error boundary de verdade (render-time, dentro da árvore React) -- cobre o que o
// `errorElement` do React Router NÃO cobre: um erro lançado depois que a rota já
// montou (ex.: efeito, handler de evento chamando setState que rejeita). Usado na
// raiz e em qualquer subárvore que precise sobreviver a um erro do resto da tela.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback message={this.state.error.message} onRetry={this.reset} />
    }
    return this.props.children
  }
}

// `errorElement` de rota (React Router 7, modo data router) -- cobre erro de loader/
// action e erro de render síncrono da própria rota. Erro em /portaria aqui não
// derruba o resto da aplicação: só o `<Outlet/>` daquela rota é substituído.
export function RouteErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return <ErrorFallback message={`${error.status} - ${error.statusText || 'Erro ao carregar a rota'}`} />
  }

  const message = error instanceof Error ? error.message : 'Erro inesperado ao carregar a rota'
  return <ErrorFallback message={message} />
}
