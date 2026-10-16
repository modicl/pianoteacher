import { expect, test } from 'vitest'
import { spellNote } from '../src/score-parser/names'

// letra: C=0 D=1 E=2 F=3 G=4 A=5 B=6
test('Sol bemol se llama Sol♭ y no Fa♯ (misma tecla, distinta escritura)', () => {
  expect(spellNote({ midi: 66, letter: 4, accidental: -1 }, 'solfege')).toBe('Sol♭4')
  expect(spellNote({ midi: 66, letter: 3, accidental: 1 }, 'solfege')).toBe('Fa♯4')
  expect(spellNote({ midi: 66, letter: 4, accidental: -1 }, 'letters')).toBe('G♭4')
})

test('doble bemol y doble sostenido', () => {
  expect(spellNote({ midi: 74, letter: 2, accidental: -2 }, 'solfege')).toBe('Mi♭♭5')
  expect(spellNote({ midi: 67, letter: 3, accidental: 2 }, 'letters')).toBe('F♯♯4')
})

test('Do bemol: la octava es la escrita (Do♭4 suena como Si3)', () => {
  expect(spellNote({ midi: 59, letter: 0, accidental: -1 }, 'solfege')).toBe('Do♭4')
})

test('con 8va la octava sube junto con el sonido', () => {
  expect(spellNote({ midi: 78, letter: 4, accidental: -1 }, 'letters')).toBe('G♭5')
})

test('sin octava (para la partitura)', () => {
  expect(spellNote({ midi: 66, letter: 4, accidental: -1 }, 'solfege', false)).toBe('Sol♭')
  expect(spellNote({ midi: 60, letter: 0, accidental: 0 }, 'solfege', false)).toBe('Do')
})

test('sin ortografía conocida se usa la escritura con sostenidos', () => {
  expect(spellNote({ midi: 61 }, 'solfege')).toBe('Do♯4')
  expect(spellNote({ midi: 61 }, 'letters', false)).toBe('C♯')
})

test('datos incoherentes (letra y altura no encajan) caen a la escritura por defecto', () => {
  expect(spellNote({ midi: 61, letter: 4, accidental: 0 }, 'letters')).toBe('C♯4')
})
