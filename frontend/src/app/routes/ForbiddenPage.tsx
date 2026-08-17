import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <>
      <h1>Acesso não permitido</h1>
      <p>Sua conta não tem acesso a esta página.</p>
      <p>
        <Link to="/">Voltar para o catálogo</Link>
      </p>
    </>
  )
}
