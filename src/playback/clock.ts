import type { Note } from '../score-parser'

export function activeNotes(notes: Note[], beat: number): Note[] {
  return notes.filter(n => n.startBeat <= beat + 1e-9 && beat < n.startBeat + n.durationBeats - 1e-9)
}

export function beatToSeconds(beat: number, bpm: number, speed: number): number {
  return (beat * 60) / bpm / speed
}

/** Reloj de reproducción: avanza una posición en pulsos y avisa qué notas empiezan y terminan. */
export class Transport {
  speed = 1
  position = 0
  playing = false
  onNoteOn?: (n: Note) => void
  onNoteOff?: (n: Note) => void
  onEnd?: () => void

  private active = new Set<Note>()
  private readonly endBeat: number
  private readonly notes: Note[]
  private readonly bpm: number

  constructor(notes: Note[], bpm: number) {
    this.notes = notes
    this.bpm = bpm
    this.endBeat = notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0)
  }

  play() {
    if (this.position >= this.endBeat) this.seek(0)
    this.playing = true
  }

  pause() {
    this.playing = false
    this.releaseAll()
  }

  seek(beat: number) {
    this.releaseAll()
    this.position = Math.max(0, beat)
    if (this.playing) this.sync()
  }

  seekMeasure(measure: number, beatsPerMeasure: number) {
    this.seek((measure - 1) * beatsPerMeasure)
  }

  tick(dtSeconds: number) {
    if (!this.playing) return
    this.position += (dtSeconds * this.bpm * this.speed) / 60
    if (this.position >= this.endBeat) {
      this.releaseAll()
      this.playing = false
      this.onEnd?.()
      return
    }
    this.sync()
  }

  get activeNow(): Note[] {
    return [...this.active]
  }

  private sync() {
    const now = new Set(activeNotes(this.notes, this.position))
    for (const n of this.active) if (!now.has(n)) this.onNoteOff?.(n)
    for (const n of now) if (!this.active.has(n)) this.onNoteOn?.(n)
    this.active = now
  }

  private releaseAll() {
    for (const n of this.active) this.onNoteOff?.(n)
    this.active.clear()
  }
}
