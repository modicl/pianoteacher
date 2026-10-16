import type { Note } from './notes'

/** Pulso en que empieza cada compás (índice = compás - 1). */
export function measureStartsFor(measures: number, beatsPerMeasure: number, pickup: number): number[] {
  if (pickup === 0) return Array.from({ length: measures }, (_, i) => i * beatsPerMeasure)
  return Array.from({ length: measures }, (_, i) => (i === 0 ? 0 : pickup + (i - 1) * beatsPerMeasure))
}

/**
 * Anacrusa: el primer compás dura menos que el compás y el último lo completa.
 * Entonces el compás 2 empieza `pickup` pulsos después del 1 (y no `beatsPerMeasure`).
 * Los pulsos de entrada asumen compases enteros: (compás - 1) * beatsPerMeasure.
 */
export function applyPickup(
  notes: Note[], lengths: Map<number, number>, beatsPerMeasure: number, measures: number,
): { notes: Note[]; pickup: number } {
  const first = lengths.get(1)
  const last = lengths.get(measures)
  const eps = 1e-3
  const isPickup = first !== undefined && last !== undefined && measures > 1
    && first > eps && first < beatsPerMeasure - eps
    && Math.abs(first + last - beatsPerMeasure) < eps
  if (!isPickup) return { notes, pickup: 0 }
  const shift = first - beatsPerMeasure
  return { pickup: first, notes: notes.map(n => (n.measure >= 2 ? { ...n, startBeat: n.startBeat + shift } : n)) }
}
