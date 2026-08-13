import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import type { OrganizerEvent } from '../api'
import { EventEditForm } from './EventEditForm'

const API = env.VITE_API_URL

function makeEvent(overrides: Partial<OrganizerEvent> = {}): OrganizerEvent {
  return {
    id: 'evt-1',
    organizerId: 'org-1',
    source: 'TMDB',
    externalId: '1',
    title: 'Duna',
    genres: [],
    venueName: 'Cinemark Shopping',
    venueCity: 'São Paulo',
    venueState: 'SP',
    type: 'SEATED',
    status: 'DRAFT',
    startsAt: '2026-09-20T23:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    currency: 'BRL',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    organizer: { id: 'org-1', name: 'Organizador' },
    _count: { tickets: 0 },
    ...overrides,
  }
}

function renderForm(event: OrganizerEvent) {
  return renderWithProviders(<EventEditForm event={event} />)
}

afterEach(() => {
  queryClient.clear()
})

describe('EventEditForm', () => {
  it('sem vendas -- todos os campos habilitados; preço em reais convertido de volta para centavos', async () => {
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.patch(`${API}/events/evt-1`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeEvent({ venueCity: 'Rio de Janeiro', venueState: 'RJ' }))
      }),
    )
    const user = userEvent.setup()
    renderForm(makeEvent())

    const stateTrigger = screen.getByLabelText('Estado')
    await waitFor(() => expect(stateTrigger).toBeEnabled())
    await user.click(stateTrigger)
    await user.click(await screen.findByRole('option', { name: 'Rio de Janeiro' }))

    // trocar de estado limpa a cidade e refaz a busca de municípios pela UF nova --
    // espera o picker sair do estado "buscando" (desabilitado) antes de abrir
    await waitFor(() => expect(screen.getByLabelText('Cidade')).toBeEnabled())
    await user.click(screen.getByLabelText('Cidade'))
    await user.click(await screen.findByRole('option', { name: 'Rio de Janeiro' }))

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toMatchObject({ venueCity: 'Rio de Janeiro', venueState: 'RJ', priceInCents: 3200 })
  })

  it('com vendas -- estado, cidade, data, horário, fuso e preço ficam desabilitados; local continua editável', () => {
    renderForm(makeEvent({ _count: { tickets: 5 } }))

    expect(screen.getByLabelText('Estado')).toBeDisabled()
    expect(screen.getByLabelText('Cidade')).toBeDisabled()
    expect(screen.getByLabelText('Data')).toBeDisabled()
    expect(screen.getByLabelText('Horário')).toBeDisabled()
    expect(screen.getByLabelText('Preço (R$)')).toBeDisabled()
    expect(screen.getByLabelText('Local')).toBeEnabled()
    expect(screen.getByText(/já vendeu ingressos/)).toBeInTheDocument()
  })

  it('com vendas -- salvar não envia os campos bloqueados, mesmo alterando só o local', async () => {
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.patch(`${API}/events/evt-1`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeEvent({ _count: { tickets: 5 }, venueName: 'Outro Cinema' }))
      }),
    )
    const user = userEvent.setup()
    renderForm(makeEvent({ _count: { tickets: 5 } }))

    const venueInput = screen.getByLabelText('Local')
    await user.clear(venueInput)
    await user.type(venueInput, 'Outro Cinema')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toEqual({ venueName: 'Outro Cinema', synopsis: '' })
  })
})
