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

export function contrastRatio(colorA: string, colorB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(colorA))
  const luminanceB = relativeLuminance(hexToRgb(colorB))
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

export function mixOverBackground(foreground: string, backgroundBehind: string, foregroundPercent: number): string {
  const [fr, fg, fb] = hexToRgb(foreground)
  const [br, bg, bb] = hexToRgb(backgroundBehind)
  const p = foregroundPercent / 100
  const mixChannel = (f: number, b: number) => Math.round(f * p + b * (1 - p))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mixChannel(fr, br))}${toHex(mixChannel(fg, bg))}${toHex(mixChannel(fb, bb))}`
}
