import type { UseQueryResult } from '@tanstack/react-query'

export type QueryState<TData> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'empty' }
  | { status: 'content'; data: TData }

type MinimalQueryResult<TData> = Pick<UseQueryResult<TData>, 'data' | 'isLoading' | 'isError' | 'error'>

export function useQueryState<TData>(
  query: MinimalQueryResult<TData>,
  isEmpty: (data: TData) => boolean,
): QueryState<TData> {
  if (query.isLoading) return { status: 'loading' }
  if (query.isError) return { status: 'error', error: query.error }
  if (query.data === undefined || isEmpty(query.data)) return { status: 'empty' }
  return { status: 'content', data: query.data }
}
