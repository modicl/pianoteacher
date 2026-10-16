import { expect, test } from 'vitest'
import { diatonicFromY, midiFromDiatonic, noteName } from '../src/score-parser/pitch'
import type { Staff } from '../src/score-parser/staves'

const staff: Staff = { lines: [100, 104.75, 109.5, 114.25, 119], spacing: 4.75, x1: 0, x2: 500 }

test('sol: línea inferior es E4', () => {
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'treble'), 0)).toBe(64)
})
test('sol: espacio sobre la línea superior es G5', () => {
  expect(midiFromDiatonic(diatonicFromY(97.625, staff, 'treble'), 0)).toBe(79)
})
test('fa: línea inferior es G2', () => {
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'bass'), 0)).toBe(43)
})
test('bemol baja un semitono y doble bemol dos', () => {
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'treble'), -1)).toBe(63)
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'treble'), -2)).toBe(62)
})
test('líneas adicionales: do central bajo el pentagrama de sol', () => {
  expect(midiFromDiatonic(diatonicFromY(119 + 4.75, staff, 'treble'), 0)).toBe(60)
})
test('nombres', () => {
  expect(noteName(60, 'letters')).toBe('C4')
  expect(noteName(61, 'solfege')).toBe('Do♯4')
})
