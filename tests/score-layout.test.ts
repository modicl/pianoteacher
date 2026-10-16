import { expect, test } from 'vitest'
import { fitScale, scrollTargetFor } from '../src/ui/score-layout'

test('la escala ajusta la página al ancho disponible', () => {
  expect(fitScale(1100, 595)).toBeCloseTo(1100 / 595)
})

test('la escala tiene un máximo (en pantallas enormes) y un mínimo', () => {
  expect(fitScale(5000, 595)).toBe(2.4)
  expect(fitScale(100, 595)).toBe(0.5)
})

test('ancho cero o inválido no rompe', () => {
  expect(fitScale(0, 595)).toBe(0.5)
  expect(fitScale(800, 0)).toBe(0.5)
})

test('el scroll deja la nota activa a ~40% de la altura visible', () => {
  // nota en y=500pt, escala 2 → 1000px; ventana de 600px → 1000 - 240 = 760
  expect(scrollTargetFor([500], 2, 600, 3000)).toBe(760)
})

test('con varias notas se centra en la más alta de la pantalla (la del pentagrama superior)', () => {
  expect(scrollTargetFor([520, 480], 2, 600, 3000)).toBe(960 - 240)
})

test('el scroll nunca es negativo ni pasa del final', () => {
  expect(scrollTargetFor([10], 2, 600, 3000)).toBe(0)
  expect(scrollTargetFor([1400], 2, 600, 3000)).toBe(2400)
})

test('sin notas no hay objetivo', () => {
  expect(scrollTargetFor([], 2, 600, 3000)).toBeNull()
})
