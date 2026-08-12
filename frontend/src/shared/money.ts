// Dinheiro sempre por esta função (§4.6.1) -- nunca `parseFloat`, nunca template
// string com `/100` espalhado pelas telas. Entrada em centavos (inteiro), igual ao
// que a API sempre devolve.
export function formatMoney(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}
