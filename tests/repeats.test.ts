import { expect, test } from 'vitest'
import { playOrder, unrollNotes } from '../src/score-parser/repeats'
import type { Note } from '../src/score-parser'

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

test('sin repeticiones se toca en línea recta', () => {
  expect(playOrder(4, { starts: [], ends: [], voltas: [] })).toEqual([1, 2, 3, 4])
})

test('repetición simple desde el inicio', () => {
  expect(playOrder(3, { starts: [], ends: [2], voltas: [] })).toEqual([1, 2, 1, 2, 3])
})

test('repetición con inicio en el compás 2', () => {
  expect(playOrder(4, { starts: [2], ends: [3], voltas: [] })).toEqual([1, 2, 3, 2, 3, 4])
})

test('casillas 1 y 2 (como National Park: inicio 8, final 41, casilla 1 = 41, casilla 2 = 42)', () => {
  const order = playOrder(43, { starts: [8], ends: [41], voltas: [{ number: 1, measure: 41 }, { number: 2, measure: 42 }] })
  expect(order).toEqual([...range(1, 41), ...range(8, 40), 42, 43])
})

test('dos repeticiones seguidas', () => {
  expect(playOrder(5, { starts: [1, 4], ends: [2, 5], voltas: [] })).toEqual([1, 2, 1, 2, 3, 4, 5, 4, 5])
})

test('una repetición mal formada no cuelga el programa', () => {
  const order = playOrder(3, { starts: [3], ends: [1], voltas: [{ number: 1, measure: 1 }] })
  expect(order.length).toBeLessThan(40)
  expect(order[0]).toBe(1)
})

const note = (measure: number, startBeat: number): Note =>
  ({ midi: 60, startBeat, durationBeats: 1, hand: 'R', page: 0, x: 0, y: 0, measure })

test('desenrollar copia las notas de cada compás en la repetición', () => {
  const notes = [note(1, 0), note(2, 4), note(3, 8)]
  const starts = [0, 4, 8]
  const r = unrollNotes(notes, [1, 2, 1, 2, 3], starts, 4)
  expect(r.notes.map(n => [n.measure, n.startBeat])).toEqual([[1, 0], [2, 4], [1, 8], [2, 12], [3, 16]])
  expect(r.occurrenceStarts).toEqual([0, 4, 8, 12, 16])
})

test('desenrollar respeta un primer compás corto (anacrusa)', () => {
  const notes = [note(1, 0), note(2, 1), note(3, 5)]
  const starts = [0, 1, 5]
  const r = unrollNotes(notes, [1, 2, 3], starts, 4)
  expect(r.notes.map(n => n.startBeat)).toEqual([0, 1, 5])
  expect(r.occurrenceStarts).toEqual([0, 1, 5])
})
