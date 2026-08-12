export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ticketdev:theme'

// 'system' nunca é gravado no atributo -- ausência de `data-theme` já cai no
// `@media (prefers-color-scheme)` de tokens.css. Só light/dark força a mão sobre o
// SO (portaria costuma operar em ambiente escuro; forçar o tema do SO seria hostil).
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

// Persiste e aplica. O flash-antes-da-pintura já foi resolvido pelo script inline em
// index.html (lê a mesma STORAGE_KEY) -- esta função é para toda troca DEPOIS do
// primeiro paint (o seletor de tema, § componentes).
export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage indisponível -- tema ainda se aplica nesta sessão, só não persiste
  }
  applyTheme(theme)
}
