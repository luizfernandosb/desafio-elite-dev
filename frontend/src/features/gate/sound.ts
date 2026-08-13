import type { ResultTone } from './status'

// Web Audio puro, sem arquivo de áudio -- um beep é só um oscilador por ~150ms, e o
// projeto não tem asset de som nenhum ainda. Tom agudo para VÁLIDO, grave para o
// resto (§ etapa 10, "som distinto para válido vs. os demais").
const FREQUENCY_BY_TONE: Record<ResultTone, number> = {
  valid: 880,
  invalid: 220,
  used: 330,
  neutral: 330,
}

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null
  audioContext ??= new AudioContext()
  return audioContext
}

// Nunca lança nem bloqueia o fluxo de validação -- som é reforço sensorial (§ etapa
// 10), não parte do contrato. Autoplay bloqueado, contexto suspenso ou navegador sem
// suporte só significam "sem som", nunca uma tela quebrada.
export function playResultSound(tone: ResultTone): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.frequency.value = FREQUENCY_BY_TONE[tone]
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.15)
  } catch {
    // ambiente sem suporte a Web Audio (ou autoplay bloqueado) -- silencioso de propósito
  }
}
