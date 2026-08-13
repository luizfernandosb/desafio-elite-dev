import type { UseQueryResult } from '@tanstack/react-query'

export type QueryState<TData> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'empty' }
  | { status: 'content'; data: TData }

type MinimalQueryResult<TData> = Pick<UseQueryResult<TData>, 'data' | 'isLoading' | 'isError' | 'error'>

// Padroniza a árvore de decisão que toda tela que consome API repete (§ etapa 11):
// carregando -> erro -> vazio -> conteúdo, sempre nesta ordem, nunca reimplementada
// tela a tela com um `if` improvisado. `isEmpty` é obrigatório, não opcional --
// decidir o que conta como "vazio" é específico de cada tela (lista paginada, array
// simples, recurso único que nunca tem um estado vazio de verdade); este hook não
// adivinha, e um default errado (ex.: sempre `false`) esconderia bugs de silêncio.
export function useQueryState<TData>(
  query: MinimalQueryResult<TData>,
  isEmpty: (data: TData) => boolean,
): QueryState<TData> {
  if (query.isLoading) return { status: 'loading' }
  if (query.isError) return { status: 'error', error: query.error }
  if (query.data === undefined || isEmpty(query.data)) return { status: 'empty' }
  return { status: 'content', data: query.data }
}
