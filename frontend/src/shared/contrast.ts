// Razão de contraste WCAG (relative luminance) -- função pura, sem DOM/browser. Serve
// para medir pares de token antes de qualquer tela existir (§ etapa 02); a auditoria
// completa sobre componentes renderizados de verdade é da etapa 12.
function channelToLinear(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized
  const int = Number.parseInt(full, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

// (L1 + 0.05) / (L2 + 0.05), L1 sempre a mais clara -- fórmula do WCAG 2.x, não uma
// aproximação.
export function contrastRatio(colorA: string, colorB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(colorA))
  const luminanceB = relativeLuminance(hexToRgb(colorB))
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

// Reproduz `color-mix(in srgb, foreground P%, transparent)` composto sobre um fundo
// opaco -- mesma matemática do CSS (mistura linear dos canais sRGB codificados, não
// luz linear): interpolar `transparent` com opacidade 0 equivale a compor
// `foreground` a P% de opacidade sobre `backgroundBehind`. Usado para medir os
// badges de status (etapa 09) e o feed da portaria (etapa 10), que tingem o fundo
// via `color-mix` em vez de um token sólido -- sem isto o teste teria que chutar o
// hex resultante à mão (§ etapa 12, "medido, não estimado").
export function mixOverBackground(foreground: string, backgroundBehind: string, foregroundPercent: number): string {
  const [fr, fg, fb] = hexToRgb(foreground)
  const [br, bg, bb] = hexToRgb(backgroundBehind)
  const p = foregroundPercent / 100
  const mixChannel = (f: number, b: number) => Math.round(f * p + b * (1 - p))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mixChannel(fr, br))}${toHex(mixChannel(fg, bg))}${toHex(mixChannel(fb, bb))}`
}
