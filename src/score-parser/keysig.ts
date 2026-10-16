import type { Accidental } from './pitch'

// letra: C=0 D=1 E=2 F=3 G=4 A=5 B=6
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3] // Si Mi La Re Sol Do Fa
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6] // Fa Do Sol Re La Mi Si

export type KeySignature = Map<number, Accidental>
export interface KeyItem { letter: number; acc: Accidental }

/**
 * Aplica una tira de alteraciones escrita justo después de la clave o de una barra.
 * Devuelve la armadura resultante, o null si la tira no tiene la forma de una armadura
 * (en ese caso son alteraciones sueltas de las notas).
 */
export function applyKeySignatureRun(prev: KeySignature, items: KeyItem[]): KeySignature | null {
  if (!items.length) return null
  if (items.some(it => it.acc < 0) && items.some(it => it.acc > 0)) return null
  const next: KeySignature = new Map(prev)
  let i = 0
  while (i < items.length) {
    const acc = items[i].acc
    let j = i
    while (j < items.length && items[j].acc === acc) j++
    const segment = items.slice(i, j)
    if (acc === 0) {
      for (const it of segment) {
        if (!next.has(it.letter)) return null
        next.delete(it.letter)
      }
    } else {
      // al escribir una armadura nueva sobre otra, la anterior ya fue cancelada con becuadros
      const order = acc < 0 ? FLAT_ORDER : SHARP_ORDER
      if (segment.some((it, k) => it.letter !== order[k])) return null
      for (const it of segment) next.set(it.letter, it.acc)
      // una armadura de bemoles y otra de sostenidos no conviven
      for (const [letter, a] of next) if (Math.sign(a) === -Math.sign(acc) && !segment.some(s => s.letter === letter)) next.delete(letter)
    }
    i = j
  }
  return next
}
