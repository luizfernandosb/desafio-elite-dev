import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../lib/env'
import { queryClient } from '../../../lib/query-client'
import { server } from '../../../test/msw/server'
import { renderWithProviders, TestProviders } from '../../../test/render'
import { CityPicker } from './CityPicker'

const API = env.VITE_API_URL

afterEach(() => {
  queryClient.clear()
})

describe('CityPicker', () => {
  it('sem UF escolhida, fica desabilitado e não busca cidade nenhuma', () => {
    renderWithProviders(<CityPicker uf="" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Cidade')).toBeDisabled()
  })

  it('com UF, lista os municípios da UF e reporta a escolha via onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<CityPicker uf="MG" value="" onChange={onChange} />)

    await waitFor(() => expect(screen.getByLabelText('Cidade')).toBeEnabled())
    await user.click(screen.getByLabelText('Cidade'))
    await user.click(await screen.findByRole('option', { name: 'Juiz de Fora' }))

    expect(onChange).toHaveBeenCalledWith('Juiz de Fora')
  })

  it('trocar de UF busca de novo -- lista da UF anterior não sobra', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(<CityPicker uf="MG" value="" onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Cidade')).toBeEnabled())

    rerender(
      <TestProviders>
        <CityPicker uf="RJ" value="" onChange={vi.fn()} />
      </TestProviders>,
    )
    await waitFor(() => expect(screen.getByLabelText('Cidade')).toBeEnabled())

    await user.click(screen.getByLabelText('Cidade'))
    expect(await screen.findByRole('option', { name: 'Niterói' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Belo Horizonte' })).not.toBeInTheDocument()
  })

  it('falha ao carregar cidades -- mostra toast de erro', async () => {
    server.use(
      http.get(`${API}/locations/states/:uf/cities`, () => HttpResponse.json({ code: 'X', message: 'falhou' }, { status: 500 })),
    )
    renderWithProviders(<CityPicker uf="MG" value="" onChange={vi.fn()} />)

    expect(
      await screen.findByText('Não foi possível carregar as cidades. Tente de novo.', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  })
})
