import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { server } from '../../test/msw/server'
import { IBGE_CITIES_MG, IBGE_STATES } from '../../test/msw/handlers'
import { LocationsUnavailableError } from './locations.types'
import { LocationsService } from './locations.service'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('LocationsService.getStates', () => {
  it('normaliza a lista de estados do IBGE', async () => {
    const service = new LocationsService()
    const states = await service.getStates()

    expect(states).toEqual(IBGE_STATES.map((state) => ({ id: state.id, sigla: state.sigla, nome: state.nome })))
  })

  it('segunda chamada usa o cache em memória -- não bate no IBGE de novo', async () => {
    const service = new LocationsService()
    await service.getStates()

    server.resetHandlers() // sem handler == qualquer chamada nova quebra sob 'error'
    await expect(service.getStates()).resolves.toEqual(
      IBGE_STATES.map((state) => ({ id: state.id, sigla: state.sigla, nome: state.nome })),
    )
  })

  it('erro de rede tenta 1 vez mais e, se persistir, vira LocationsUnavailableError 503', async () => {
    let calls = 0
    server.use(
      http.get('https://servicodados.ibge.gov.br/api/v1/localidades/estados', () => {
        calls += 1
        return HttpResponse.error()
      }),
    )

    const service = new LocationsService()
    const promise = service.getStates()
    await expect(promise).rejects.toThrow(LocationsUnavailableError)
    await expect(promise).rejects.toMatchObject({ statusHint: 503, code: 'LOCATIONS_UNAVAILABLE' })
    expect(calls).toBe(2) // 1 tentativa + 1 retry
  })

  it('cache existente é servido mesmo se a chamada seguinte falhar', async () => {
    const service = new LocationsService()
    await service.getStates()

    server.use(
      http.get('https://servicodados.ibge.gov.br/api/v1/localidades/estados', () => HttpResponse.error()),
    )

    // cache ainda "fresco" (TTL de 24h) -- nem chega a tentar a rede de novo
    await expect(service.getStates()).resolves.toEqual(
      IBGE_STATES.map((state) => ({ id: state.id, sigla: state.sigla, nome: state.nome })),
    )
  })
})

describe('LocationsService.getCities', () => {
  it('normaliza a lista de municípios do IBGE para a UF pedida', async () => {
    const service = new LocationsService()
    const cities = await service.getCities('MG')

    expect(cities).toEqual(IBGE_CITIES_MG.map((city) => ({ id: city.id, nome: city.nome })))
  })

  it('UF sem correspondência no mock devolve lista vazia, não erro', async () => {
    const service = new LocationsService()
    const cities = await service.getCities('SP')
    expect(cities).toEqual([])
  })

  it('cache é por UF -- trocar de estado bate no IBGE de novo', async () => {
    let calls = 0
    server.use(
      http.get('https://servicodados.ibge.gov.br/api/v1/localidades/estados/:uf/municipios', ({ params }) => {
        calls += 1
        if (params.uf === 'MG') return HttpResponse.json(IBGE_CITIES_MG)
        return HttpResponse.json([])
      }),
    )

    const service = new LocationsService()
    await service.getCities('MG')
    await service.getCities('MG') // cache -- não soma chamada
    await service.getCities('SP') // UF diferente -- soma chamada

    expect(calls).toBe(2)
  })
})
