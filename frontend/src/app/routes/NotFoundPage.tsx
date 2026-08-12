import { Link } from 'react-router-dom'

// Página 404 própria -- não a página genérica de "Not Found" de um provedor de deploy.
export function NotFoundPage() {
  return (
    <>
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/">Voltar para o catálogo</Link>
      </p>
    </>
  )
}
