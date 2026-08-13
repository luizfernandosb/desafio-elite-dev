import { AppError } from '../../shared/errors'

export interface StateOption {
  id: number
  sigla: string
  nome: string
}

export interface CityOption {
  id: number
  nome: string
}

export class LocationsUnavailableError extends AppError {
  constructor() {
    super('LOCATIONS_UNAVAILABLE', 'Serviço de localidades indisponível', 503)
  }
}
