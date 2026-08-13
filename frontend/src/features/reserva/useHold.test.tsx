import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../lib/env'
import { queryClient } from '../../lib/query-client'
import { server } from '../../test/msw/server'
import { TestProviders } from '../../test/render'
import { useHold } from './useHold'

const API = env.VITE_API_URL

function wrapper({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>
}

afterEach(() => {
  queryClient.clear()
})

describe('useHold', () => {
  it('201 -- chama onHoldCreated com os holds criados pelo servidor', async () => {
    const createdHold = {
      id: 'hold-1',
      eventId: 'evt-1',
      seatId: 'seat-1',
      userId: 'u1',
      expiresAt: '2026-01-01T10:10:00.000Z',
    }
    server.use(
      http.post(`${API}/events/evt-1/holds`, () => HttpResponse.json({ data: [createdHold] }, { status: 201 })),
    )
    const onHoldCreated = vi.fn()
    const onSeatsTaken = vi.fn()
    const { result } = renderHook(() => useHold({ eventId: 'evt-1', onHoldCreated, onSeatsTaken }), { wrapper })

    result.current.hold(['seat-1'])

    await waitFor(() => expect(onHoldCreated).toHaveBeenCalledWith([createdHold]))
    expect(onSeatsTaken).not.toHaveBeenCalled()
  })

  it('409 SEAT_TAKEN -- chama onSeatsTaken com os assentos que o SERVIDOR indicou, não os que o cliente pediu', async () => {
    server.use(
      http.post(`${API}/events/evt-1/holds`, () =>
        HttpResponse.json({ code: 'SEAT_TAKEN', message: 'Assento já reservado', takenSeatIds: ['seat-2'] }, { status: 409 }),
      ),
    )
    const onHoldCreated = vi.fn()
    const onSeatsTaken = vi.fn()
    const { result } = renderHook(() => useHold({ eventId: 'evt-1', onHoldCreated, onSeatsTaken }), { wrapper })

    result.current.hold(['seat-1', 'seat-2'])

    await waitFor(() => expect(onSeatsTaken).toHaveBeenCalledWith(['seat-2']))
    expect(onHoldCreated).not.toHaveBeenCalled()
  })

  it('outro erro (ex.: HOLD_LIMIT_EXCEEDED) não chama onSeatsTaken -- só SEAT_TAKEN ajusta a seleção', async () => {
    server.use(
      http.post(`${API}/events/evt-1/holds`, () =>
        HttpResponse.json({ code: 'HOLD_LIMIT_EXCEEDED', message: 'Limite de 6 assentos' }, { status: 409 }),
      ),
    )
    const onHoldCreated = vi.fn()
    const onSeatsTaken = vi.fn()
    const { result } = renderHook(() => useHold({ eventId: 'evt-1', onHoldCreated, onSeatsTaken }), { wrapper })

    result.current.hold(['seat-1'])

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(onSeatsTaken).not.toHaveBeenCalled()
    expect(onHoldCreated).not.toHaveBeenCalled()
  })
})
