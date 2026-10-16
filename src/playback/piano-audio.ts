export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

interface Voice { gain: GainNode; oscillators: OscillatorNode[] }

/** Sintetizador de piano simple con Web Audio (sin muestras). Cada nota tiene su propia voz. */
export class PianoAudio {
  enabled = true
  private ctx: AudioContext | null = null
  private voices = new Map<object, Voice>()

  /** Crea/reanuda el contexto de audio. Hay que llamarlo dentro de un clic (Safari/iOS no deja sonar si no). */
  unlock() {
    this.context()
  }

  /** Safari anterior a 14.1 solo tiene webkitAudioContext; sin ninguna, la app queda muda pero funciona. */
  private context(): AudioContext | null {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  noteOn(key: object, midi: number) {
    if (!this.enabled) return
    this.noteOff(key)
    const ctx = this.context()
    if (!ctx) return
    const now = ctx.currentTime
    const freq = midiToFrequency(midi)
    const gain = ctx.createGain()
    const peak = 0.22 * Math.max(0.15, Math.min(1, 1.6 - midi / 90))
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.4)
    gain.gain.exponentialRampToValueAtTime(peak * 0.12, now + 3)
    gain.connect(ctx.destination)

    const oscillators = [
      this.oscillator(ctx, 'triangle', freq, 1, gain),
      this.oscillator(ctx, 'sine', freq * 2, 0.3, gain),
    ]
    this.voices.set(key, { gain, oscillators })
  }

  noteOff(key: object) {
    const ctx = this.ctx
    const voice = this.voices.get(key)
    if (!ctx || !voice) return
    this.voices.delete(key)
    this.release(ctx, voice, 0.25)
  }

  /** Corta todo lo que esté sonando (pausa, saltos, cambio de partitura). */
  stopAll() {
    const ctx = this.ctx
    if (!ctx) return
    for (const voice of this.voices.values()) this.release(ctx, voice, 0.05)
    this.voices.clear()
  }

  private release(ctx: AudioContext, voice: Voice, seconds: number) {
    const now = ctx.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now)
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
    for (const o of voice.oscillators) o.stop(now + seconds + 0.05)
  }

  private oscillator(ctx: AudioContext, type: OscillatorType, freq: number, level: number, out: GainNode) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.value = level
    osc.connect(g).connect(out)
    osc.start()
    return osc
  }
}
