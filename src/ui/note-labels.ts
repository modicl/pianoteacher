import type { Note } from '../score-parser'
import { spellNote } from '../score-parser/names'

export interface NoteLabel { x: number; y: number; text: string; hand: 'R' | 'L' }

/**
 * Rótulos con el nombre de las notas de una página, para dibujarlos sobre la partitura.
 * Las notas que empiezan juntas en la misma mano (un acorde) forman un solo rótulo, de la más aguda a la más grave.
 */
export function labelsForPage(notes: Note[], page: number, style: 'letters' | 'solfege'): NoteLabel[] {
  const groups = new Map<string, Note[]>()
  for (const n of notes) {
    if (n.page !== page) continue
    const key = `${n.hand}|${n.measure}|${n.startBeat.toFixed(4)}`
    groups.set(key, [...(groups.get(key) ?? []), n])
  }
  return [...groups.values()].map(group => {
    const byPitch = [...group].sort((a, b) => b.midi - a.midi)
    const top = group.reduce((best, n) => (n.y < best.y ? n : best), group[0])
    return { x: top.x, y: top.y, text: byPitch.map(n => spellNote(n, style, false)).join(' '), hand: group[0].hand }
  })
}
