import { expect, test } from 'vitest'
import { applyKeySignatureRun } from '../src/score-parser/keysig'

// letra: C=0 D=1 E=2 F=3 G=4 A=5 B=6
const flat = (letter: number) => ({ letter, acc: -1 as const })
const sharp = (letter: number) => ({ letter, acc: 1 as const })
const natural = (letter: number) => ({ letter, acc: 0 as const })

test('cinco bemoles en el orden Si Mi La Re Sol', () => {
  const key = applyKeySignatureRun(new Map(), [6, 2, 5, 1, 4].map(flat))
  expect(key).not.toBeNull()
  expect([...key!].sort()).toEqual([[1, -1], [2, -1], [4, -1], [5, -1], [6, -1]])
})

test('un solo sostenido debe ser Fa', () => {
  expect(applyKeySignatureRun(new Map(), [sharp(3)])!.get(3)).toBe(1)
  expect(applyKeySignatureRun(new Map(), [sharp(0)])).toBeNull()
})

test('un orden que no es el de una armadura se rechaza (es una alteración suelta)', () => {
  expect(applyKeySignatureRun(new Map(), [flat(2), flat(6)])).toBeNull()
  expect(applyKeySignatureRun(new Map(), [flat(2)])).toBeNull()
})

test('mezclar bemoles y sostenidos sin becuadros se rechaza', () => {
  expect(applyKeySignatureRun(new Map(), [flat(6), sharp(3)])).toBeNull()
})

test('los becuadros cancelan la armadura anterior', () => {
  const prev = new Map([[6, -1], [2, -1]] as [number, -1][])
  expect(applyKeySignatureRun(prev, [natural(6), natural(2)])!.size).toBe(0)
})

test('cancelar y escribir una armadura nueva', () => {
  const prev = new Map([[6, -1], [2, -1]] as [number, -1][])
  const next = applyKeySignatureRun(prev, [natural(6), natural(2), sharp(3)])!
  expect([...next]).toEqual([[3, 1]])
})

test('un becuadro de una letra que no estaba en la armadura se rechaza', () => {
  expect(applyKeySignatureRun(new Map(), [natural(3)])).toBeNull()
})
