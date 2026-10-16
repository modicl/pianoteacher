import type { Glyph } from './types'
import type { Accidental } from './pitch'

/** Valor en pulsos (negra = 1) de cada cabeza de nota de la fuente Opus. */
export const HEAD_BEATS: Record<string, number> = { 'œ': 1, '˙': 2, 'w': 4 }
export const ACCIDENTALS: Record<string, Accidental> = { 'b': -1, '∫': -2, 'n': 0, '#': 1, 'x': 2 }
/** Silencios (en pulsos). */
export const REST_BEATS: Record<string, number> = { 'Œ': 1, '‰': 0.5, '≈': 0.25 }
export const DOT = '™'
/** Corchetes sueltos: cantidad de colas (1 = corchea, 2 = semicorchea). */
export const FLAG_LEVELS: Record<string, number> = { 'J': 1, 'j': 1, 'r': 2 }
export const NORMAL_SIZE = 15

export const isOpusStd = (g: Glyph) => g.font.endsWith('OpusStd')
export const isOpusSpecial = (g: Glyph) => g.font.endsWith('OpusSpecialStd')
export const isOpusText = (g: Glyph) => g.font.endsWith('OpusTextStd')

/** Las apoyaturas se dibujan en tamaño reducido. */
export const isNormalSize = (g: Glyph) => g.size >= NORMAL_SIZE

/** Glifos de OpusStd que el parser entiende; cualquier otro dentro del pentagrama se trata como silencio de duración desconocida. */
export const isKnownOpusChar = (char: string) =>
  char in HEAD_BEATS || char in ACCIDENTALS || char in REST_BEATS || char in FLAG_LEVELS
  || char === '&' || char === '?' || char === '.' || /\d/.test(char)
