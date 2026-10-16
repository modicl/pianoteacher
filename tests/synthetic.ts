import type { Glyph, PageData, Segment } from '../src/score-parser/types'

/** Pentagrama sintético de piano: dos pentagramas, compases de ancho fijo. Sirve para probar casos que el PDF de ejemplo no tiene. */
export const SPACING = 4.745
export const TOP = 100
export const BOTTOM = 160
const FONT = 'XXXXXX+OpusStd'

export const lineY = (staff: 0 | 1, i: number) => (staff === 0 ? TOP : BOTTOM) + i * SPACING

export function emptyPage(measures: number, width = 220): { page: PageData; barX: number[] } {
  const x1 = 40
  const barX = Array.from({ length: measures + 1 }, (_, i) => x1 + i * width)
  const segments: Segment[] = []
  for (const staff of [0, 1] as const) {
    for (let i = 0; i < 5; i++) {
      segments.push({ x1, y1: lineY(staff, i), x2: barX[measures], y2: lineY(staff, i), width: 0.5 })
    }
  }
  for (const x of barX) segments.push({ x1: x, y1: lineY(0, 0), x2: x, y2: lineY(1, 4), width: 0.74 })
  return { page: { index: 0, width: 600, height: 800, glyphs: [], segments, shapes: [] }, barX }
}

/** Clave de sol + fa para que las alturas sean las habituales. */
export function addClefs(page: PageData, x = 46) {
  page.glyphs.push({ char: '&', font: FONT, x, y: lineY(0, 3), size: 19 })
  page.glyphs.push({ char: '?', font: FONT, x, y: lineY(1, 1), size: 19 })
}

/** Negra con plica hacia arriba. `step` cuenta medias líneas desde la línea inferior (0 = línea inferior). */
export function quarter(page: PageData, staff: 0 | 1, x: number, step: number, char = 'œ') {
  const y = lineY(staff, 4) - step * (SPACING / 2)
  page.glyphs.push({ char, font: FONT, x, y, size: 19 })
  page.segments.push({ x1: x + 6.5, y1: y, x2: x + 6.5, y2: y - 16.6, width: 0.45 })
}

export function glyph(page: PageData, char: string, x: number, y: number, size = 19): Glyph {
  const g = { char, font: FONT, x, y, size }
  page.glyphs.push(g)
  return g
}
