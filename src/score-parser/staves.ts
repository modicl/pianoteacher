import type { PageData } from './types'

export interface Staff { lines: number[]; spacing: number; x1: number; x2: number }
export interface System { staves: [Staff, Staff]; barlines: number[] }

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

export function detectSystems(page: PageData): System[] {
  // líneas de pentagrama: trazos horizontales largos
  const horizontals = page.segments
    .filter(s => s.width > 0.2 && near(s.y1, s.y2, 0.3) && Math.abs(s.x2 - s.x1) > 100)
    .map(s => ({ y: s.y1, x1: Math.min(s.x1, s.x2), x2: Math.max(s.x1, s.x2) }))
    .sort((a, b) => a.y - b.y)
  const unique: typeof horizontals = []
  for (const h of horizontals) {
    const last = unique[unique.length - 1]
    if (last && near(last.y, h.y, 0.2)) { last.x1 = Math.min(last.x1, h.x1); last.x2 = Math.max(last.x2, h.x2) }
    else unique.push({ ...h })
  }

  const staves: Staff[] = []
  for (let i = 0; i + 4 < unique.length; ) {
    const group = unique.slice(i, i + 5)
    const gap = (group[4].y - group[0].y) / 4
    if (gap > 3 && gap < 7 && group.every((g, k) => near(g.y, group[0].y + gap * k, 0.35))) {
      staves.push({
        lines: group.map(g => g.y), spacing: gap,
        x1: Math.min(...group.map(g => g.x1)), x2: Math.max(...group.map(g => g.x2)),
      })
      i += 5
    } else i += 1
  }

  // dos pentagramas forman un sistema si una barra de compás los atraviesa a ambos
  const barsAcross = (top: Staff, bottom: Staff) => {
    const y1 = top.lines[0], y2 = bottom.lines[4]
    const xs = page.segments
      .filter(s => near(s.x1, s.x2, 0.3) && s.width > 0.5 && s.width < 1.2
        && Math.min(s.y1, s.y2) <= y1 + 1 && Math.max(s.y1, s.y2) >= y2 - 1)
      .map(s => s.x1)
      .sort((a, b) => a - b)
    const barlines: number[] = []
    for (const x of xs) {
      const last = barlines[barlines.length - 1]
      if (last === undefined || x - last > 6) barlines.push(x)
    }
    return barlines
  }

  const systems: System[] = []
  for (let i = 0; i + 1 < staves.length; ) {
    const barlines = barsAcross(staves[i], staves[i + 1])
    if (barlines.length) { systems.push({ staves: [staves[i], staves[i + 1]], barlines }); i += 2 }
    else i += 1 // pentagrama suelto (p. ej. una línea de melodía): se ignora sin descuadrar los siguientes
  }
  return systems
}
