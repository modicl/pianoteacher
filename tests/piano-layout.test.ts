import { expect, test } from 'vitest'
import { buildKeys, whiteKeyCount } from '../src/ui/piano-layout'

test('88 teclas: 52 blancas y 36 negras', () => {
  const keys = buildKeys()
  expect(keys).toHaveLength(88)
  expect(keys.filter(k => !k.black)).toHaveLength(52)
  expect(keys.filter(k => k.black)).toHaveLength(36)
  expect(whiteKeyCount(keys)).toBe(52)
})

test('rango A0..C8', () => {
  const keys = buildKeys()
  expect(keys[0].midi).toBe(21)
  expect(keys[keys.length - 1].midi).toBe(108)
})

test('do central es blanca y do sostenido es negra', () => {
  const keys = buildKeys()
  expect(keys.find(k => k.midi === 60)!.black).toBe(false)
  expect(keys.find(k => k.midi === 61)!.black).toBe(true)
})

test('una negra queda entre dos blancas consecutivas', () => {
  const keys = buildKeys()
  const c = keys.find(k => k.midi === 60)!
  const cs = keys.find(k => k.midi === 61)!
  const d = keys.find(k => k.midi === 62)!
  expect(cs.index).toBe(c.index)
  expect(d.index).toBe(c.index + 1)
})
