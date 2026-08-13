// Códigos de UF do IBGE -- não mudam (mesmo raciocínio de MAX_ROWS/MAX_SEATS_PER_ROW
// serem constantes, não configuráveis). Fonte única de verdade para validar
// `venueState` (events.schema.ts) e o parâmetro `:uf` (modules/locations/locations.schema.ts).
export const BRAZIL_UF_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export type BrazilUf = (typeof BRAZIL_UF_CODES)[number]
