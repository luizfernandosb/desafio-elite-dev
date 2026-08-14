// Cores oficiais da classificação indicativa brasileira (Ministério da Justiça) --
// fixas por padrão do governo, não fazem parte da paleta do produto. Mesmo tipo de
// exceção documentada em tokens.css para os blocos de cor da portaria: um domínio
// com identidade visual própria, definida fora daqui, não reinventada por nós.
const AGE_RATING_COLORS: Record<string, { background: string; color: string }> = {
  L: { background: '#0d8a3e', color: '#ffffff' },
  '10': { background: '#0072bc', color: '#ffffff' },
  '12': { background: '#f7d117', color: '#1a1a1a' },
  '14': { background: '#f07f00', color: '#ffffff' },
  '16': { background: '#e6172c', color: '#ffffff' },
  '18': { background: '#000000', color: '#ffffff' },
}

const DEFAULT_COLORS = { background: '#4a4a4a', color: '#ffffff' }

// Valor fora da tabela (rating que o TMDb não usa, ou versão futura da
// classificação) cai num cinza neutro em vez de sumir -- ainda mostra o texto.
export function ageRatingColors(rating: string): { background: string; color: string } {
  return AGE_RATING_COLORS[rating] ?? DEFAULT_COLORS
}
