import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { extractPage } from '../src/score-parser/extract'
import { detectSystems } from '../src/score-parser/staves'

const pdf = () => new Uint8Array(readFileSync('tests/fixtures/national-park.pdf'))

test('página 1: 5 sistemas de 2 pentagramas, spacing ≈ 4.745', async () => {
  const systems = detectSystems(await extractPage(pdf(), 0))
  expect(systems).toHaveLength(5)
  for (const s of systems) {
    expect(s.staves[0].lines).toHaveLength(5)
    expect(s.staves[0].spacing).toBeCloseTo(4.745, 1)
    expect(s.staves[1].lines[0]).toBeGreaterThan(s.staves[0].lines[4])
    expect(s.barlines.length).toBeGreaterThanOrEqual(3)
  }
  // primer sistema: compases 1-3 → 4 barras (inicio, 2 internas, fin)
  expect(systems[0].barlines).toHaveLength(4)
})

test('todas las páginas tienen sistemas', async () => {
  for (let i = 1; i < 3; i++) expect(detectSystems(await extractPage(pdf(), i)).length).toBeGreaterThan(0)
})

test('todos los sistemas de las 3 páginas tienen barras de compás (cada sistema = 2 pentagramas contiguos)', async () => {
  for (let i = 0; i < 3; i++) {
    const systems = detectSystems(await extractPage(pdf(), i))
    expect(systems.length).toBe(i === 0 ? 5 : i === 1 ? 5 : 5)
    for (const s of systems) {
      expect(s.barlines.length).toBeGreaterThanOrEqual(3)
      // los dos pentagramas de un sistema están a menos de 20 espacios
      expect(s.staves[1].lines[0] - s.staves[0].lines[4]).toBeLessThan(80)
    }
  }
})

test('un pentagrama suelto antes de un sistema no descuadra el emparejamiento', async () => {
  const { emptyPage, lineY } = await import('./synthetic')
  const { page } = emptyPage(2)
  // pentagrama extra, sin barra que lo una al siguiente, 60 pt sobre el sistema
  for (let i = 0; i < 5; i++) page.segments.push({ x1: 40, y1: lineY(0, 0) - 60 + i * 4.745, x2: 480, y2: lineY(0, 0) - 60 + i * 4.745, width: 0.5 })
  const systems = detectSystems(page)
  expect(systems).toHaveLength(1)
  expect(systems[0].staves[0].lines[0]).toBeCloseTo(lineY(0, 0))
})
