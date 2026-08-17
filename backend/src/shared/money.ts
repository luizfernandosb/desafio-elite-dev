export function isValidCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
