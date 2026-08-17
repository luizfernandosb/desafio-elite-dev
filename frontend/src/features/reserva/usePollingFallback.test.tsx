import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '../../lib/query-client'
import { TestProviders } from '../../test/render'
import { usePollingFallback } from './usePollingFallback'
import type { RealtimeConnectionStatus } from './useSeatRealtime'

function wrapper({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>
}

afterEach(() => {
  vi.useRealTimers()
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('usePollingFallback', () => {
  it('SUBSCRIBED -- nunca fez polling, primeiro SUBSCRIBED não revalida à toa', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    renderHook(() => usePollingFallback('SUBSCRIBED', 'evt-1'), { wrapper })

    vi.advanceTimersByTime(20000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('canal caído (CHANNEL_ERROR) -- invalida o snapshot a cada 5s', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    renderHook(() => usePollingFallback('CHANNEL_ERROR', 'evt-1'), { wrapper })

    vi.advanceTimersByTime(5000)
    expect(spy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('reconecta (volta a SUBSCRIBED) -- revalida uma vez e para de fazer polling', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { rerender } = renderHook<void, { status: RealtimeConnectionStatus }>(
      ({ status }) => usePollingFallback(status, 'evt-1'),
      { wrapper, initialProps: { status: 'CHANNEL_ERROR' } },
    )

    vi.advanceTimersByTime(5000)
    expect(spy).toHaveBeenCalledTimes(1)

    rerender({ status: 'SUBSCRIBED' })
    expect(spy).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(20000)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
