import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useIdempotencyKey } from './useIdempotencyKey'

describe('useIdempotencyKey', () => {
  it('gera uma chave e mantém a mesma entre re-renders da mesma sessão de checkout', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey())
    const first = result.current
    expect(first).toMatch(/^[0-9a-f-]{36}$/i)

    rerender()
    expect(result.current).toBe(first)

    rerender()
    expect(result.current).toBe(first)
  })

  it('duas sessões de checkout diferentes (duas montagens) geram chaves diferentes', () => {
    const { result: sessionA } = renderHook(() => useIdempotencyKey())
    const { result: sessionB } = renderHook(() => useIdempotencyKey())

    expect(sessionA.current).not.toBe(sessionB.current)
  })
})
