import { expect, test } from 'vitest'
import { applyPickup, measureStartsFor } from '../src/score-parser/pickup'
import type { Note } from '../src/score-parser'

const note = (measure: number, startBeat: number, midi = 60): Note =>
  ({ midi, startBeat, durationBeats: 1, hand: 'R', page: 0, x: 0, y: 0, measure })

test('sin anacrusa los compases miden lo del compás', () => {
  expect(measureStartsFor(3, 4, 0)).toEqual([0, 4, 8])
})

test('con anacrusa el compás 1 es corto y los demás se corren', () => {
  expect(measureStartsFor(3, 4, 1)).toEqual([0, 1, 5])
})

test('se detecta una anacrusa: primer compás corto y el último lo completa', () => {
  // compás 1: 1 tiempo; compás 2: 4 tiempos; compás 3 (último): 3 tiempos
  const notes = [note(1, 0), note(2, 4), note(3, 8)]
  const lengths = new Map([[1, 1], [2, 4], [3, 3]])
  const r = applyPickup(notes, lengths, 4, 3)
  expect(r.pickup).toBe(1)
  expect(r.notes.map(n => n.startBeat)).toEqual([0, 1, 5])
})

test('un primer compás corto sin compás final complementario NO es anacrusa', () => {
  const notes = [note(1, 0), note(2, 4), note(3, 8)]
  const lengths = new Map([[1, 1], [2, 4], [3, 4]])
  const r = applyPickup(notes, lengths, 4, 3)
  expect(r.pickup).toBe(0)
  expect(r.notes.map(n => n.startBeat)).toEqual([0, 4, 8])
})
