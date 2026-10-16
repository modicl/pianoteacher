import { noteName } from './pitch'

const SEMITONES = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
const NAMES = {
  letters: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  solfege: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
}
const ACCIDENTAL_SYMBOL: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 0: '', 1: '♯', 2: '♯♯' }

export interface Spelled { midi: number; letter?: number; accidental?: number }

/**
 * Nombre de la nota como está escrita en la partitura: con armadura de bemoles es Sol♭, no Fa♯ (misma tecla).
 * Sin ortografía conocida se usa la escritura con sostenidos.
 */
export function spellNote(n: Spelled, style: 'letters' | 'solfege', withOctave = true): string {
  const fallback = () => {
    const name = noteName(n.midi, style)
    return withOctave ? name : name.replace(/-?\d+$/, '')
  }
  if (n.letter === undefined || n.accidental === undefined || !(n.accidental in ACCIDENTAL_SYMBOL)) return fallback()
  const rest = n.midi - n.accidental - SEMITONES[n.letter]
  if (rest % 12 !== 0) return fallback() // la letra no encaja con la altura: mejor la escritura por defecto
  const octave = rest / 12 - 1
  return `${NAMES[style][n.letter]}${ACCIDENTAL_SYMBOL[n.accidental]}${withOctave ? octave : ''}`
}
