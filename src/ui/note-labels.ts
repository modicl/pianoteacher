import type { Note } from '../score-parser'
import { spellNote } from '../score-parser/names'

/** level: 0 = pegado a la nota; 1, 2… = más lejos del pentagrama, para que un rótulo no tape al vecino. */
export interface NoteLabel { x: number; y: number; text: string; hand: 'R' | 'L'; level: number }

const CHAR_WIDTH = 3.8
const LABEL_PADDING = 3
const SAME_ROW = 60

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
  const labels = [...groups.values()].map(group => {
    const byPitch = [...group].sort((a, b) => b.midi - a.midi)
    const top = group.reduce((best, n) => (n.y < best.y ? n : best), group[0])
    return { x: top.x, y: top.y, text: byPitch.map(n => spellNote(n, style, false)).join(' '), hand: group[0].hand, level: 0 }
  })
  return stagger(labels)
}


/**
 * Los nombres son más anchos que el espacio entre notas rápidas y el rótulo siguiente tapaba al anterior
 * («Sol La La Sol» se leía mezclado). Aquí cada rótulo sube a la primera altura donde no choca con el de su izquierda.
 */
function stagger(labels: NoteLabel[]): NoteLabel[] {
  const widthOf = (l: NoteLabel) => l.text.length * CHAR_WIDTH + LABEL_PADDING
  const placed: { label: NoteLabel; end: number }[] = []
  const ordered = [...labels].sort((a, b) => a.x - b.x)
  for (const label of ordered) {
    const start = label.x - widthOf(label) / 2
    const near = placed.filter(p => p.label.hand === label.hand && Math.abs(p.label.y - label.y) < SAME_ROW)
    let level = 0
    while (near.some(p => p.label.level === level && p.end > start)) level++
    label.level = level
    placed.push({ label, end: label.x + widthOf(label) / 2 })
  }
  return labels
}
