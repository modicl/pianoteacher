import { expect, test } from 'vitest'
import { detectSystems } from '../src/score-parser/staves'
import { parsePage } from '../src/score-parser/notes'
import { addClefs, emptyPage, glyph, lineY, quarter } from './synthetic'

test('sanidad del montaje sintético: cuatro negras de sol suman 4 tiempos', () => {
  const { page, barX } = emptyPage(1)
  addClefs(page)
  ;[80, 110, 140, 170].forEach(x => quarter(page, 0, x, 0))
  const systems = detectSystems(page)
  expect(systems).toHaveLength(1)
  const r = parsePage(page, systems, { beatsPerMeasure: 4, firstMeasure: 1 })
  expect(r.warnings).toEqual([])
  expect(r.notes.map(n => [n.midi, n.startBeat])).toEqual([[64, 0], [64, 1], [64, 2], [64, 3]])
  expect(barX).toHaveLength(2)
})

test('silencio de duración desconocida (glifo que no conozco) completa el compás', () => {
  const { page } = emptyPage(1)
  addClefs(page)
  glyph(page, 'Ó', 70, lineY(0, 2)) // silencio de blanca en una fuente que no está en la tabla
  quarter(page, 0, 120, 0)
  quarter(page, 0, 160, 0)
  const r = parsePage(page, detectSystems(page), { beatsPerMeasure: 4, firstMeasure: 1 })
  expect(r.warnings).toEqual([])
  expect(r.notes.map(n => n.startBeat)).toEqual([2, 3])
})

test('compás de 3/4: tres negras suman 3 sin avisos', () => {
  const { page } = emptyPage(1)
  addClefs(page)
  ;[80, 120, 160].forEach(x => quarter(page, 0, x, 0))
  const r = parsePage(page, detectSystems(page), { beatsPerMeasure: 3, firstMeasure: 1 })
  expect(r.warnings).toEqual([])
  expect(r.notes).toHaveLength(3)
})

test('armadura de un sostenido (Fa) al comienzo: el Fa suena sostenido en todas las octavas', () => {
  const { page } = emptyPage(1)
  addClefs(page)
  glyph(page, '#', 60, lineY(0, 0)) // Fa5, línea superior
  quarter(page, 0, 110, 1)          // Fa4 (espacio inferior, 1 media línea sobre E4)
  quarter(page, 0, 150, 8)          // Fa5 (línea superior)
  quarter(page, 0, 190, 2)          // Sol4
  const r = parsePage(page, detectSystems(page), { beatsPerMeasure: 3, firstMeasure: 1 })
  const byX = (x: number) => r.notes.find(n => Math.abs(n.x - (x + 3.25)) < 1)!.midi
  expect(byX(110)).toBe(66) // Fa♯4
  expect(byX(150)).toBe(78) // Fa♯5
  expect(byX(190)).toBe(67) // Sol4 intacto
})

test('una alteración suelta en el primer compás no se confunde con armadura (Do mayor)', () => {
  const { page } = emptyPage(1)
  addClefs(page)
  glyph(page, '#', 82, lineY(0, 4) - 1 * (4.745 / 2)) // sostenido pegado a su nota Fa4
  quarter(page, 0, 92, 1)                              // Fa4 con # local
  quarter(page, 0, 140, 8)                             // Fa5 sin alteración: debe ser natural
  const r = parsePage(page, detectSystems(page), { beatsPerMeasure: 2, firstMeasure: 1 })
  const byX = (x: number) => r.notes.find(n => Math.abs(n.x - (x + 3.25)) < 1)!.midi
  expect(byX(92)).toBe(66)
  expect(byX(140)).toBe(77)
})

test('8vb en la mano izquierda baja una octava', () => {
  const { page } = emptyPage(1)
  addClefs(page)
  const bassY = lineY(1, 4) + 25
  page.glyphs.push({ char: '“', font: 'XXXXXX+OpusSpecialStd', x: 60, y: bassY, size: 19 })
  page.segments.push({ x1: 70, y1: bassY - 5, x2: 200, y2: bassY - 5, width: 0.5 })
  quarter(page, 1, 110, 0) // Sol2 (43) escrito → suena Sol1 (31)
  const r = parsePage(page, detectSystems(page), { beatsPerMeasure: 1, firstMeasure: 1 })
  expect(r.notes[0].midi).toBe(31)
})
