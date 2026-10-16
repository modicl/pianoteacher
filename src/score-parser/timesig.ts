import type { PageData } from './types'
import type { System } from './staves'
import { isNormalSize, isOpusStd } from './glyphs'

export interface TimeSignature { numerator: number; denominator: number }

export const beatsPerMeasure = (t: TimeSignature) => (t.numerator * 4) / t.denominator

const VALID_DENOMINATORS = new Set([1, 2, 4, 8, 16, 32])

/** Lee la cifra de compás (dígitos de OpusStd dentro del pentagrama superior, antes de la primera nota). */
export function detectTimeSignature(page: PageData, systems: System[]): TimeSignature | null {
  for (const system of systems) {
    const staff = system.staves[0]
    const firstBar = system.barlines[1] ?? staff.x2
    const digits = page.glyphs.filter(g =>
      isOpusStd(g) && /\d/.test(g.char) && isNormalSize(g)
      && g.y >= staff.lines[0] && g.y <= staff.lines[4] + 1
      && g.x > staff.x1 && g.x < firstBar)
    if (digits.length < 2) continue
    const top = digits.filter(g => g.y < staff.lines[2]).sort((a, b) => a.x - b.x)
    const bottom = digits.filter(g => g.y >= staff.lines[2]).sort((a, b) => a.x - b.x)
    if (!top.length || !bottom.length) continue
    // la cifra va justo tras la armadura; se toman los dígitos más a la izquierda de cada fila
    const read = (row: typeof top) => Number(row.map(g => g.char).join(''))
    const numerator = read(top)
    const denominator = read(bottom)
    if (numerator >= 1 && numerator <= 32 && VALID_DENOMINATORS.has(denominator)) return { numerator, denominator }
  }
  return null
}
