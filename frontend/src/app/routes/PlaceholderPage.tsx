// Stub temporário -- cada rota abaixo é substituída pela tela de negócio real na
// etapa do plano de front indicada (nenhuma tela de negócio nasce na etapa 01).
interface Props {
  title: string
  etapa: string
}

export function PlaceholderPage({ title, etapa }: Props) {
  return (
    <>
      <h1>{title}</h1>
      <p>Em construção -- chega na {etapa}.</p>
    </>
  )
}
