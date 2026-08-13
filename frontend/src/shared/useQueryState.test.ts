import { describe, expect, it } from 'vitest'
import { useQueryState } from './useQueryState'

function makeQuery(
  overrides: Partial<{ data: unknown; isLoading: boolean; isError: boolean; error: Error | null }>,
) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

describe('useQueryState -- ordem de precedência (§ etapa 11)', () => {
  it('loading -- vence mesmo com isError/data presentes (estado transitório de refetch)', () => {
    const result = useQueryState(
      makeQuery({ isLoading: true, isError: true, data: [1] }),
      (data) => (data as unknown[]).length === 0,
    )
    expect(result).toEqual({ status: 'loading' })
  })

  it('error -- vence sobre vazio/conteúdo quando não está carregando', () => {
    const err = new Error('falhou')
    const result = useQueryState(makeQuery({ isError: true, error: err }), () => false)
    expect(result).toEqual({ status: 'error', error: err })
  })

  it('sem loading/error, isEmpty(data) true -- vazio', () => {
    const result = useQueryState(makeQuery({ data: [] }), (data) => (data as unknown[]).length === 0)
    expect(result).toEqual({ status: 'empty' })
  })

  it('data undefined (ainda não resolvido, sem loading/error) -- vazio, nunca conteúdo com undefined', () => {
    const result = useQueryState(makeQuery({ data: undefined }), () => false)
    expect(result).toEqual({ status: 'empty' })
  })

  it('conteúdo -- isEmpty(data) false devolve os dados', () => {
    const data = [1, 2, 3]
    const result = useQueryState(makeQuery({ data }), (d) => (d as unknown[]).length === 0)
    expect(result).toEqual({ status: 'content', data })
  })
})
