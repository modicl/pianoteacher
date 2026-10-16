import type { PageData } from './types'
import { isOpusStd, isOpusText } from './glyphs'

/** Lee una indicación tipo "♩ = 86" o "♩. = 86" y la devuelve en negras por minuto. */
export function detectTempo(page: PageData): number | null {
  const quarter = page.glyphs.find(g => isOpusText(g) && g.char === 'q')
  if (!quarter) return null
  const dotted = page.glyphs.some(
    g => isOpusStd(g) && g.char === '.' && g.x > quarter.x && g.x - quarter.x < 20 && Math.abs(g.y - quarter.y) < 10)
  const digits = page.glyphs
    .filter(g => /\d/.test(g.char) && !isOpusStd(g) && g.x > quarter.x && g.x - quarter.x < 80 && Math.abs(g.y - quarter.y) < 6)
    .sort((a, b) => a.x - b.x)
    .map(g => g.char)
    .join('')
  const value = Number(digits)
  if (!Number.isFinite(value) || value < 20 || value > 400) return null
  return value * (dotted ? 1.5 : 1)
}
