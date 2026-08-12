import { Link } from 'react-router-dom'

// Página 403 própria -- papel errado não é a mesma coisa que rota inexistente
// (NotFoundPage) nem que sessão ausente (redireciona para /entrar). Sumir com a rota
// (redirecionar pra home em silêncio) faz o usuário achar que o link está quebrado
// (§ etapa 03, guards por papel).
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
