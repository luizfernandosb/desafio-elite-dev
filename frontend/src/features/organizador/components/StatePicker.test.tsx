import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders } from '../../../test/render'
import { StatePicker } from './StatePicker'

const API = env.VITE_API_URL

afterEach(() => {
  queryClient.clear()
})

describe('StatePicker', () => {
  it('lista os estados vindos da API e reporta a escolha via onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<StatePicker value="" onChange={onChange} />)

    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Minas Gerais' }))

    expect(onChange).toHaveBeenCalledWith('MG')
  })

  it('falha ao carregar estados -- mostra toast de erro, não quebra a tela', async () => {
    server.use(http.get(`${API}/locations/states`, () => HttpResponse.json({ code: 'X', message: 'falhou' }, { status: 500 })))
    renderWithProviders(<StatePicker value="" onChange={vi.fn()} />)

    // 1 retry automático (5xx, lib/query-client.ts) com backoff -- timeout maior que
    // o default de findBy* para não flakar sob a suíte inteira rodando em paralelo
    expect(
      await screen.findByText('Não foi possível carregar os estados. Tente de novo.', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  })

  it('disabled -- não abre o seletor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StatePicker value="SP" onChange={vi.fn()} disabled />)

    await waitFor(() => expect(screen.getByLabelText('Estado')).toBeDisabled())
    await user.click(screen.getByLabelText('Estado'))
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
