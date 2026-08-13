import { describe, expect, it } from 'vitest'
import { ApiError } from '../lib/api'
import { describeError } from './errors'

describe('describeError', () => {
  it.each([
    ['VALIDATION_ERROR', 'Verifique os dados', false],
    ['NOT_FOUND', 'Não encontrado', false],
    ['FORBIDDEN', 'Sem permissão', false],
    ['RATE_LIMITED', 'Muitas tentativas', true],
    ['CATALOG_UNAVAILABLE', 'Catálogo indisponível', true],
    ['TIMEOUT', 'Demorou demais', true],
    ['NETWORK_ERROR', 'Sem conexão', true],
  ] as const)('%s -- título "%s", retry: %s', (code, title, showRetry) => {
    const error = new ApiError(code, 'mensagem do back', 400)
    expect(describeError(error)).toEqual({ title, message: 'mensagem do back', showRetry, requestId: undefined })
  })

  it('code desconhecido -- "Algo deu errado" com retry, nunca um estado restritivo por engano', () => {
    const error = new ApiError('UM_CODE_QUE_NAO_EXISTE', 'mensagem qualquer', 500)
    expect(describeError(error)).toEqual({
      title: 'Algo deu errado',
      message: 'mensagem qualquer',
      showRetry: true,
      requestId: undefined,
    })
  })

  it('requestId presente -- passa adiante para o ErrorState mostrar copiável', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Erro interno', 500, 'req-abc')
    expect(describeError(error).requestId).toBe('req-abc')
  })

  it('erro que não é ApiError -- fallback genérico, nunca a mensagem crua', () => {
    expect(describeError(new Error('stack trace interno'))).toEqual({
      title: 'Algo deu errado',
      message: 'Tente novamente em instantes.',
      showRetry: true,
      requestId: undefined,
    })
  })
})
