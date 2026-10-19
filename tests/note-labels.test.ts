import { expect, test } from 'vitest'
import { labelsForPage } from '../src/ui/note-labels'
import type { Note } from '../src/score-parser'

const n = (midi: number, letter: number, accidental: number, x: number, y: number, extra: Partial<Note> = {}): Note => ({
  midi, letter, accidental, startBeat: 0, durationBeats: 1, hand: 'R', page: 0, x, y, measure: 1, ...extra,
})

test('una nota suelta: un rótulo con su nombre', () => {
  const labels = labelsForPage([n(66, 4, -1, 100, 50)], 0, 'solfege')
  expect(labels).toEqual([{ x: 100, y: 50, text: 'Sol♭', hand: 'R', level: 0 }])
})

test('un acorde se junta en un solo rótulo, de la nota de abajo a la de arriba del pentagrama', () => {
  const chord = [n(60, 0, 0, 100, 80), n(75, 2, -1, 100, 60), n(68, 5, -1, 100, 70)]
  const labels = labelsForPage(chord, 0, 'solfege')
  expect(labels).toHaveLength(1)
  expect(labels[0].text).toBe('Do La♭ Mi♭')
  expect(labels[0].y).toBe(60)
})

test('manos distintas a la vez son rótulos distintos', () => {
  const both = [n(60, 0, 0, 100, 60), n(48, 0, 0, 100, 140, { hand: 'L' })]
  expect(labelsForPage(both, 0, 'letters').map(l => l.hand).sort()).toEqual(['L', 'R'])
})

test('solo las notas de la página pedida', () => {
  const notes = [n(60, 0, 0, 10, 10), n(62, 1, 0, 20, 20, { page: 1 })]
  expect(labelsForPage(notes, 1, 'letters').map(l => l.text)).toEqual(['D'])
})

test('notas que empiezan en tiempos distintos no se mezclan', () => {
  const notes = [n(60, 0, 0, 10, 10, { startBeat: 0 }), n(62, 1, 0, 30, 10, { startBeat: 1 })]
  expect(labelsForPage(notes, 0, 'letters')).toHaveLength(2)
})

test('notas rápidas pegadas: los rótulos que chocarían suben de altura y no se tapan', () => {
  const run = [0, 1, 2, 3].map(i => n(69, 5, 0, 100 + i * 6, 50, { startBeat: i }))
  const levels = labelsForPage(run, 0, 'solfege').sort((a, b) => a.x - b.x).map(l => l.level)
  expect(levels).toEqual([0, 1, 0, 1])
})

test('notas con espacio de sobra quedan todas a la altura normal', () => {
  const run = [0, 1, 2].map(i => n(69, 5, 0, 100 + i * 40, 50, { startBeat: i }))
  expect(labelsForPage(run, 0, 'solfege').map(l => l.level)).toEqual([0, 0, 0])
})

test('un acorde se lee por posición en el pentagrama aunque el doble bemol invierta la altura sonora', () => {
  const chord = [
    n(61, 1, -1, 100, 80), n(66, 4, -1, 100, 70), n(69, 6, -2, 100, 60), n(73, 1, -1, 100, 50),
  ]
  expect(labelsForPage(chord, 0, 'solfege')[0].text).toBe('Re♭ Sol♭ Si♭♭ Re♭')
})
