import type { Note } from './notes'

const MAX_GAP = 0.08
const EPS = 1e-3

/**
 * Cuando una nota vuelve a sonar justo al terminar la anterior (misma altura), se acorta un poco la primera
 * para que la tecla se vea soltarse y volver a bajar, y para que el audio suene como dos golpes.
 */
export function articulate(notes: Note[]): Note[] {
  const starts = new Map<number, number[]>()
  for (const n of notes) starts.set(n.midi, [...(starts.get(n.midi) ?? []), n.startBeat])
  return notes.map(n => {
    const end = n.startBeat + n.durationBeats
    const repeated = (starts.get(n.midi) ?? []).some(s => Math.abs(s - end) < EPS)
    if (!repeated) return n
    return { ...n, durationBeats: n.durationBeats - Math.min(MAX_GAP, n.durationBeats * 0.25) }
  })
}
