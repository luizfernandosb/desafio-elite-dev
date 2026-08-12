import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../../components'
import { useSeatSelection } from './useSeatSelection'

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('useSeatSelection', () => {
  it('toggle adiciona e depois remove o mesmo assento da seleção', () => {
    const { result } = renderHook(() => useSeatSelection(), { wrapper })

    act(() => result.current.toggle('seat-1'))
    expect(result.current.selectedSeatIds).toEqual(['seat-1'])

    act(() => result.current.toggle('seat-1'))
    expect(result.current.selectedSeatIds).toEqual([])
  })

  it('teto de 6 assentos por reserva -- o 7º clique não entra na seleção', () => {
    const { result } = renderHook(() => useSeatSelection(), { wrapper })

    act(() => {
      for (let i = 1; i <= 6; i++) result.current.toggle(`seat-${i}`)
    })
    expect(result.current.selectedSeatIds).toHaveLength(6)
    expect(result.current.atMax).toBe(true)

    act(() => result.current.toggle('seat-7'))
    expect(result.current.selectedSeatIds).toHaveLength(6)
    expect(result.current.selectedSeatIds).not.toContain('seat-7')
  })

  it('removeMany (409 SEAT_TAKEN) tira só os assentos indicados, preserva o resto da seleção', () => {
    const { result } = renderHook(() => useSeatSelection(), { wrapper })
    act(() => {
      result.current.toggle('seat-1')
      result.current.toggle('seat-2')
      result.current.toggle('seat-3')
    })

    act(() => result.current.removeMany(['seat-2']))
    expect(result.current.selectedSeatIds).toEqual(['seat-1', 'seat-3'])
  })

  it('clear esvazia a seleção inteira (hold confirmado consome a seleção)', () => {
    const { result } = renderHook(() => useSeatSelection(), { wrapper })
    act(() => result.current.toggle('seat-1'))

    act(() => result.current.clear())
    expect(result.current.selectedSeatIds).toEqual([])
    expect(result.current.atMax).toBe(false)
  })
})
