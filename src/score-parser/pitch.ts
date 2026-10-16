import type { Staff } from './staves'

export type Clef = 'treble' | 'bass'
export type Accidental = -2 | -1 | 0 | 1 | 2

const SEMITONES = [0, 2, 4, 5, 7, 9, 11]
// índice diatónico = octava * 7 + {C0 D1 E2 F3 G4 A5 B6}; línea inferior: E4 (sol) o G2 (fa)
const BOTTOM: Record<Clef, number> = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 }

export function diatonicFromY(y: number, staff: Staff, clef: Clef): number {
  const step = Math.round((staff.lines[4] - y) / (staff.spacing / 2))
  return BOTTOM[clef] + step
}

export function midiFromDiatonic(d: number, accidental: Accidental): number {
  const octave = Math.floor(d / 7)
  return 12 * (octave + 1) + SEMITONES[((d % 7) + 7) % 7] + accidental
}

const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']

export function noteName(midi: number, style: 'letters' | 'solfege'): string {
  const base = (style === 'letters' ? LETTERS : SOLFEGE)[((midi % 12) + 12) % 12]
  return `${base}${Math.floor(midi / 12) - 1}`
}
