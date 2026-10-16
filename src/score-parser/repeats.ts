import type { Note } from './notes'
import type { PageData } from './types'
import type { System } from './staves'

export interface Repeats {
  /** compases donde empieza una repetición (barra de inicio con puntos) */
  starts: number[]
  /** compases donde termina una repetición (barra final con puntos) */
  ends: number[]
  /** casillas 1., 2. y el compás donde empiezan */
  voltas: { number: number; measure: number }[]
}

export const noRepeats = (): Repeats => ({ starts: [], ends: [], voltas: [] })

/**
 * Orden en que se tocan los compases, desenrollando repeticiones y casillas.
 * Cada repetición se toca dos veces; en la segunda pasada la casilla 1 se salta y se sigue en la casilla 2.
 */
export function playOrder(measures: number, repeats: Repeats): number[] {
  const order: number[] = []
  const passes = new Map<number, number>()
  const startFor = (end: number) => Math.max(1, ...repeats.starts.filter(s => s <= end))
  const volta = (end: number, n: number) => {
    const from = startFor(end)
    return repeats.voltas.filter(v => v.number === n && v.measure >= (n === 1 ? from : end)).map(v => v.measure).sort((a, b) => a - b)[0]
  }
  const limit = measures * 4 + 8
  let m = 1
  while (m <= measures && order.length < limit) {
    // segunda pasada: al llegar a la casilla 1, se salta a la casilla 2
    const skipped = repeats.ends.find(e => passes.get(e) === 1 && volta(e, 1) === m)
    if (skipped !== undefined) {
      m = volta(skipped, 2) ?? skipped + 1
      passes.set(skipped, 2)
      continue
    }
    order.push(m)
    const end = repeats.ends.find(e => e === m && !passes.has(e))
    if (end !== undefined) {
      passes.set(end, 1)
      m = startFor(end)
      continue
    }
    m++
  }
  return order
}

/**
 * Copia las notas en el orden de reproducción. `measureStarts[i]` es el pulso del compás i+1 en la partitura escrita;
 * cada pasada ocupa lo que dura ese compás.
 */
export function unrollNotes(
  notes: Note[], order: number[], measureStarts: number[], beatsPerMeasure: number,
): { notes: Note[]; occurrenceStarts: number[] } {
  const byMeasure = new Map<number, Note[]>()
  for (const n of notes) byMeasure.set(n.measure, [...(byMeasure.get(n.measure) ?? []), n])
  const lengthOf = (m: number) => (m < measureStarts.length ? measureStarts[m] - measureStarts[m - 1] : beatsPerMeasure)
  const out: Note[] = []
  const occurrenceStarts: number[] = []
  let at = 0
  for (const m of order) {
    occurrenceStarts.push(at)
    for (const n of byMeasure.get(m) ?? []) {
      out.push({ ...n, startBeat: Math.max(0, at + (n.startBeat - measureStarts[m - 1])) })
    }
    at += lengthOf(m)
  }
  return { notes: out, occurrenceStarts }
}

/** Barras de repetición y casillas de un sistema. `measureBase` es el número del primer compás del sistema. */
export function detectRepeats(page: PageData, system: System, measureBase: number): Repeats {
  const result = noRepeats()
  const top = system.staves[0].lines[0]
  const bottom = system.staves[1].lines[4]
  const bar = system.barlines

  const boundaryOf = (x: number) => {
    let best = 0
    for (let i = 1; i < bar.length; i++) if (Math.abs(bar[i] - x) < Math.abs(bar[best] - x)) best = i
    return best
  }

  // barras gruesas con puntos a un lado
  const thick = page.segments.filter(s =>
    Math.abs(s.x1 - s.x2) < 0.3 && s.width > 1.5 && s.width < 5
    && Math.min(s.y1, s.y2) <= top + 1 && Math.max(s.y1, s.y2) >= bottom - 1)
  for (const t of thick) {
    const dots = page.glyphs.filter(g => g.char === '™' && g.y > top - 3 && g.y < bottom + 3 && Math.abs(g.x - t.x1) < 18)
    if (dots.length < 2) continue
    const right = dots.filter(d => d.x > t.x1).length
    const b = boundaryOf(t.x1)
    if (right > dots.length / 2) result.starts.push(measureBase + b)       // puntos a la derecha: empieza el compás b
    else result.ends.push(measureBase + b - 1)                              // puntos a la izquierda: termina el compás b-1
  }

  // casillas: "1." / "2." sobre el pentagrama superior
  const above = page.glyphs.filter(g => g.y < top - 5 && g.y > top - 45 && g.x >= bar[0] && g.x <= bar[bar.length - 1])
  for (const g of above) {
    if (g.char !== '1' && g.char !== '2') continue
    const dot = above.find(d => d.char === '.' && d.x > g.x && d.x - g.x < 20 && Math.abs(d.y - g.y) < 2)
    if (!dot) continue
    const b = bar.findIndex((x, i) => i < bar.length - 1 && g.x >= x - 2 && g.x < bar[i + 1])
    if (b >= 0) result.voltas.push({ number: Number(g.char), measure: measureBase + b })
  }
  return result
}
