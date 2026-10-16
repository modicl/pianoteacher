import { expect, test } from 'vitest'
import { articulate } from '../src/score-parser/articulate'
import type { Note } from '../src/score-parser'

const note = (midi: number, startBeat: number, durationBeats: number, hand: 'R' | 'L' = 'R'): Note =>
  ({ midi, startBeat, durationBeats, hand, page: 0, x: 0, y: 0, measure: 1 })

test('dos notas iguales seguidas se separan con un pequeño silencio', () => {
  const [a, b] = articulate([note(60, 0, 1), note(60, 1, 1)])
  expect(a.durationBeats).toBeLessThan(1)
  expect(a.durationBeats).toBeGreaterThan(0.7)
  expect(b.durationBeats).toBe(1)
})

test('una nota seguida por otra distinta no se toca', () => {
  const [a] = articulate([note(60, 0, 1), note(62, 1, 1)])
  expect(a.durationBeats).toBe(1)
})

test('la misma altura en la otra mano también se separa', () => {
  const [a] = articulate([note(60, 0, 1, 'R'), note(60, 1, 1, 'L')])
  expect(a.durationBeats).toBeLessThan(1)
})

test('notas muy cortas se acortan proporcionalmente, nunca a cero', () => {
  const [a] = articulate([note(60, 0, 0.125), note(60, 0.125, 0.125)])
  expect(a.durationBeats).toBeGreaterThan(0.05)
  expect(a.durationBeats).toBeLessThan(0.125)
})

test('no modifica la lista original', () => {
  const input = [note(60, 0, 1), note(60, 1, 1)]
  articulate(input)
  expect(input[0].durationBeats).toBe(1)
})
