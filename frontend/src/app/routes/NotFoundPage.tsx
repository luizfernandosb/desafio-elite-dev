import { Link } from 'react-router-dom'

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
