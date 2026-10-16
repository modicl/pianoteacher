import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { extractPage, pageCount } from '../src/score-parser/extract'

const pdf = () => new Uint8Array(readFileSync('tests/fixtures/national-park.pdf'))

test('3 páginas', async () => { expect(await pageCount(pdf())).toBe(3) })

test('página 1 tiene los glifos y trazos esperados', async () => {
  const p = await extractPage(pdf(), 0)
  expect(Math.round(p.width)).toBe(596)
  expect(p.glyphs.filter(g => g.char === 'œ').length).toBeGreaterThan(250)
  const horizontal = p.segments.filter(s => Math.abs(s.y1 - s.y2) < 0.5)
  expect(horizontal.length).toBeGreaterThan(200)
})
