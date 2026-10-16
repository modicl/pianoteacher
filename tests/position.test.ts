import { expect, test } from 'vitest'
import { occurrenceAt } from '../src/playback/position'

test('encuentra qué compás de la reproducción contiene un pulso', () => {
  const starts = [0, 4, 8, 12]
  expect(occurrenceAt(starts, 0)).toBe(0)
  expect(occurrenceAt(starts, 3.99)).toBe(0)
  expect(occurrenceAt(starts, 4)).toBe(1)
  expect(occurrenceAt(starts, 11)).toBe(2)
  expect(occurrenceAt(starts, 99)).toBe(3)
})

test('pulsos negativos o lista vacía no rompen', () => {
  expect(occurrenceAt([0, 4], -2)).toBe(0)
  expect(occurrenceAt([], 3)).toBe(0)
})

test('con anacrusa el primer compás es corto', () => {
  const starts = [0, 1, 5]
  expect(occurrenceAt(starts, 0.5)).toBe(0)
  expect(occurrenceAt(starts, 1)).toBe(1)
})
