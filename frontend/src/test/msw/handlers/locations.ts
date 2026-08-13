import { http, HttpResponse } from 'msw'
import { env } from '../../../lib/env'
import type { CityOption, StateOption } from '../../../features/organizador/api'

const API = env.VITE_API_URL

export const STATES: StateOption[] = [
  { id: 31, sigla: 'MG', nome: 'Minas Gerais' },
  { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro' },
  { id: 35, sigla: 'SP', nome: 'São Paulo' },
]

const CITIES_BY_UF: Record<string, CityOption[]> = {
  MG: [{ id: 3106200, nome: 'Belo Horizonte' }, { id: 3136702, nome: 'Juiz de Fora' }],
  RJ: [{ id: 3304557, nome: 'Rio de Janeiro' }, { id: 3303500, nome: 'Niterói' }],
  SP: [{ id: 3550308, nome: 'São Paulo' }, { id: 3509502, nome: 'Campinas' }],
}

export const locationsHandlers = [
  http.get(`${API}/locations/states`, () => HttpResponse.json({ data: STATES })),

  http.get(`${API}/locations/states/:uf/cities`, ({ params }) => {
    const cities = CITIES_BY_UF[params.uf as string] ?? []
    return HttpResponse.json({ data: cities })
  }),
]
