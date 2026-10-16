import { extractPage, pageCount } from './extract'
import { detectSystems } from './staves'
import { parsePage, type Note, type Warning } from './notes'
import { detectTempo } from './tempo'
import { beatsPerMeasure as beatsOf, detectTimeSignature, type TimeSignature } from './timesig'
import { applyPickup, measureStartsFor } from './pickup'
import { articulate } from './articulate'
import { noRepeats, playOrder, unrollNotes, type Repeats } from './repeats'

export type { Note, Warning } from './notes'

const DEFAULT_TEMPO = 100

export interface Score {
  /** Notas tal como están escritas (una vez cada una). */
  notes: Note[]
  tempoBpm: number
  beatsPerMeasure: number
  warnings: Warning[]
  pageCount: number
  measures: number
  /** Pulso en que empieza cada compás escrito (índice = compás - 1). */
  measureStarts: number[]
  /** Repeticiones y casillas encontradas. */
  repeats: Repeats
  /** Orden en que se tocan los compases (con repeticiones desenrolladas). */
  order: number[]
  /** Notas en el orden de reproducción: copias con el tiempo de cada pasada. */
  playback: Note[]
  /** Pulso de reproducción en que empieza cada elemento de `order`. */
  occurrenceStarts: number[]
}

export async function parseScore(
  pdfData: Uint8Array,
  debug?: Parameters<typeof parsePage>[2]['debug'],
): Promise<Score> {
  const total = await pageCount(pdfData)
  const pages = []
  for (let i = 0; i < total; i++) {
    const page = await extractPage(pdfData, i)
    pages.push({ page, systems: detectSystems(page) })
  }
  if (!pages.some(p => p.systems.length)) throw new Error('Este PDF no parece una partitura vectorial')

  let tempoBpm: number | null = null
  let timeSignature: TimeSignature | null = null
  for (const { page, systems } of pages) {
    tempoBpm ??= detectTempo(page)
    timeSignature ??= detectTimeSignature(page, systems)
  }
  const beatsPerMeasure = timeSignature ? beatsOf(timeSignature) : 4

  let notes: Note[] = []
  let warnings: Warning[] = []
  const lengths = new Map<number, number>()
  const repeats = noRepeats()
  let measures = 0
  for (const { page, systems } of pages) {
    const result = parsePage(page, systems, { beatsPerMeasure, firstMeasure: measures + 1, debug })
    notes.push(...result.notes)
    warnings.push(...result.warnings)
    repeats.starts.push(...result.repeats.starts)
    repeats.ends.push(...result.repeats.ends)
    repeats.voltas.push(...result.repeats.voltas)
    for (const [m, len] of result.lengths) lengths.set(m, Math.max(lengths.get(m) ?? 0, len))
    measures += result.measures
  }
  if (!notes.length) {
    throw new Error('No encontré notas en este PDF. Solo se leen partituras con fuente musical Opus (Sibelius)')
  }

  const withPickup = applyPickup(notes, lengths, beatsPerMeasure, measures)
  notes = articulate(withPickup.notes)
  if (withPickup.pickup > 0) warnings = warnings.filter(w => w.measure !== 1 && w.measure !== measures)

  const measureStarts = measureStartsFor(measures, beatsPerMeasure, withPickup.pickup)
  const order = playOrder(measures, repeats)
  const unrolled = unrollNotes(notes, order, measureStarts, beatsPerMeasure)
  return {
    notes, tempoBpm: tempoBpm ?? DEFAULT_TEMPO, beatsPerMeasure, warnings, pageCount: total, measures,
    measureStarts, repeats, order, playback: unrolled.notes, occurrenceStarts: unrolled.occurrenceStarts,
  }
}
