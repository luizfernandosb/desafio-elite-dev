import type { ResultTone } from './status'

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
  } catch {}
}
