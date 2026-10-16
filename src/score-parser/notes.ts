import type { Glyph, PageData, Segment, Shape } from './types'
import type { Staff, System } from './staves'
import { diatonicFromY, midiFromDiatonic, type Accidental, type Clef } from './pitch'
import { detectRepeats, noRepeats, type Repeats } from './repeats'
import { applyKeySignatureRun, type KeySignature } from './keysig'
import {
  ACCIDENTALS, DOT, FLAG_LEVELS, HEAD_BEATS, REST_BEATS, isKnownOpusChar, isNormalSize, isOpusSpecial, isOpusStd, isOpusText,
} from './glyphs'

export interface Note {
  midi: number; startBeat: number; durationBeats: number; hand: 'R' | 'L'
  page: number; x: number; y: number; measure: number
  /** letra escrita (C=0 … B=6) y alteración escrita (-2…2): distingue Sol♭ de Fa♯ */
  letter?: number; accidental?: number
}
export interface Warning { page: number; measure: number; message: string }

export interface ParseContext {
  beatsPerMeasure: number; firstMeasure: number
  debug?: (info: { measure: number; staff: number; anchor: number; nominal: number; scale: number; rest: boolean; midi: number[]; start: number; up?: boolean; head?: number }) => void
}
export interface PageResult { notes: Note[]; warnings: Warning[]; measures: number; lengths: Map<number, number>; repeats: Repeats }

const HEAD_WIDTH = 6.5
const MIN_GRACE_SIZE = 8
const GRACE_BEATS = 0.125
const SLICE_TOLERANCE = 2.5

interface Head {
  g: Glyph; staff: number; d: number; clef: Clef; measure: number
  acc: Accidental | null; dotted: boolean; stem: Segment | null; up: boolean; shift: number; grace: boolean
}
interface Group {
  staff: number; measure: number; anchor: number; heads: Head[]
  nominal: number; scale: number; rest: boolean
  /** dirección de la plica (o posición del silencio): separa las voces de un mismo pentagrama */
  up: boolean
  /** altura del extremo de la plica (o de la cabeza/silencio): el número de un grupo irregular queda cerca */
  y: number
  /** silencio cuya duración no se conoce: se calcula como lo que falta para completar el compás */
  unknown?: boolean
}

const nearestStaff = (staves: Staff[], y: number) =>
  staves.reduce((best, s, i) => (Math.abs(s.lines[2] - y) < Math.abs(staves[best].lines[2] - y) ? i : best), 0)

function measureOf(barlines: number[], x: number): number {
  let m = -1
  for (let i = 0; i < barlines.length - 1; i++) if (x >= barlines[i] - 0.5 && x < barlines[i + 1] - 0.5) m = i
  return m
}

function beamsAt(beam: Shape, x: number): [number, number] {
  const [bl, br, tr, tl] = beam.pts
  const t = br[0] === bl[0] ? 0 : (x - bl[0]) / (br[0] - bl[0])
  const bottom = bl[1] + (br[1] - bl[1]) * t
  const top = tl[1] + (tr[1] - tl[1]) * t
  return [Math.min(top, bottom), Math.max(top, bottom)]
}

/** Cantidad de barras/corchetes en el extremo de la plica (0 = negra). */
function beamLevels(stem: Segment, up: boolean, beams: Shape[], flags: Glyph[]): number {
  const tip = up ? Math.min(stem.y1, stem.y2) : Math.max(stem.y1, stem.y2)
  let count = 0
  for (const b of beams) {
    if (stem.x1 < b.x1 - 0.4 || stem.x1 > b.x2 + 0.4) continue
    const [top, bottom] = beamsAt(b, stem.x1)
    const ok = up ? top >= tip - 1.2 && top <= tip + 9.5 : bottom <= tip + 1.2 && bottom >= tip - 9.5
    if (ok) count++
  }
  if (count === 0) {
    for (const f of flags) {
      if (Math.abs(f.x - stem.x1) < 2.5 && Math.abs(f.y - tip) < 14) { count = FLAG_LEVELS[f.char]; break }
    }
  }
  return count
}

function tupletRatio(n: number): number {
  if (n < 3) return 1
  return 2 ** Math.floor(Math.log2(n)) / n
}

interface TupletNumber { n: number; x: number; y: number }
interface Timeline { starts: Map<Group, number>; end: number }

/** Reparte el tiempo de una secuencia ordenada de grupos (columnas simultáneas avanzan por la más corta). */
function timeline(seq: Group[]): Timeline {
  const slices: Group[][] = []
  for (const g of seq) {
    const cur = slices[slices.length - 1]
    if (cur && g.anchor - cur[0].anchor <= SLICE_TOLERANCE) cur.push(g)
    else slices.push([g])
  }
  const starts = new Map<Group, number>()
  let t = 0
  let end = 0
  for (const slice of slices) {
    for (const g of slice) {
      starts.set(g, t)
      end = Math.max(end, t + g.nominal * g.scale)
    }
    t += Math.min(...slice.map(g => g.nominal * g.scale))
  }
  return { starts, end }
}

/** Busca, para cada número de grupo irregular, la ventana de n grupos consecutivos que mejor lo centra. */
function applyTuplets(numbers: TupletNumber[], sequences: Group[][], maxScore = 30) {
  const used = new Set<Group>()
  for (const num of numbers) {
    if (num.n < 3) continue
    let best: { score: number; window: Group[] } | null = null
    for (const seq of sequences) {
      for (let i = 0; i + num.n <= seq.length; i++) {
        const w = seq.slice(i, i + num.n)
        if (w.some(g => g.measure !== w[0].measure)) continue
        const mean = w.reduce((s, g) => s + g.anchor + 3, 0) / w.length
        const equal = w.every(g => Math.abs(g.nominal - w[0].nominal) < 1e-9)
        const overlap = w.filter(g => used.has(g)).length
        const meanY = w.reduce((t, g) => t + g.y, 0) / w.length
        const score = Math.abs(mean - num.x) + (equal ? 0 : 25) + overlap * 40 + Math.abs(meanY - num.y) * 0.4
        if (!best || score < best.score) best = { score, window: w }
      }
    }
    if (best && best.score < maxScore) {
      const f = tupletRatio(num.n)
      for (const g of best.window) { g.scale = f; used.add(g) }
    }
  }
}

const GAP_EPS = 0.01

/**
 * Dos voces en un pentagrama (plicas arriba / abajo). Cada voz avanza por la suma de sus duraciones; la voz que
 * llena el compás fija el tiempo y la otra coloca su silencio oculto donde la posición horizontal sea consistente.
 */
function voiceSolve(seq: Group[], numbers: TupletNumber[], beats: number): Timeline | null {
  const voices = [seq.filter(g => g.up), seq.filter(g => !g.up)]
    .filter(v => v.length)
    .map(v => v.sort((a, b) => a.anchor - b.anchor))
  if (voices.length < 2) return null
  const saved = seq.map(g => g.scale)
  const restore = () => { seq.forEach((g, i) => { g.scale = saved[i] }) }
  seq.forEach(g => { g.scale = 1 })
  applyTuplets(numbers, voices, 14)
  const duration = (g: Group) => g.nominal * g.scale
  const sums = voices.map(v => v.reduce((t, g) => t + duration(g), 0))
  const [main, side] = sums[0] >= sums[1] ? [0, 1] : [1, 0]
  if (Math.abs(sums[main] - beats) > 1e-3 || sums[side] > beats + 1e-3) { restore(); return null }

  const starts = new Map<Group, number>()
  let t = 0
  for (const g of voices[main]) { starts.set(g, t); t += duration(g) }

  const other = voices[side]
  const shortfall = beats - sums[side]
  const place = (gapBefore: number) => {
    const map = new Map<Group, number>()
    let at = 0
    other.forEach((g, i) => {
      if (i === gapBefore) at += shortfall
      map.set(g, at)
      at += duration(g)
    })
    return map
  }
  const violations = (candidate: Map<Group, number>) => {
    let n = 0
    for (const [a, ta] of candidate) {
      for (const [b, tb] of starts) {
        const dx = a.anchor - b.anchor
        if (Math.abs(dx) < SLICE_TOLERANCE) { if (Math.abs(ta - tb) > GAP_EPS) n++ }
        else if (dx < 0) { if (ta > tb + GAP_EPS) n++ }
        else if (ta + GAP_EPS < tb) n++
      }
    }
    return n
  }
  let best = place(0)
  let bestScore = violations(best)
  for (let k = 1; k <= other.length && shortfall > 1e-3; k++) {
    const candidate = place(k)
    const score = violations(candidate)
    if (score < bestScore) { best = candidate; bestScore = score }
  }
  for (const [g, at] of best) starts.set(g, at)
  return { starts, end: beats }
}

const midiOf = (h: Head) => midiFromDiatonic(h.d, (h.acc ?? 0) as Accidental) + h.shift

interface Ottava { start: number; end: number; shift: number; staff: number }

/**
 * 8va / 8vb: el texto "8" (OpusSpecial “) seguido de una línea punteada a su altura.
 * Sobre el pentagrama superior sube una octava; bajo el inferior baja una octava.
 */
function findOttavas(glyphs: Glyph[], segments: Segment[], staves: Staff[]): Ottava[] {
  const spans: Ottava[] = []
  for (const g of glyphs) {
    if (!isOpusSpecial(g) || g.char !== '“') continue
    const above = g.y < staves[0].lines[0] && g.y > staves[0].lines[0] - 60
    const below = g.y > staves[1].lines[4] && g.y < staves[1].lines[4] + 60
    if (!above && !below) continue
    const staff = above ? 0 : 1
    const top = staves[staff]
    const line = segments.filter(s =>
      Math.abs(s.y1 - s.y2) < 0.3 && s.y1 >= g.y - 10 && s.y1 <= g.y - 2 && Math.min(s.x1, s.x2) >= g.x - 2)
    if (!line.length) continue
    const y = line[0].y1
    const same = line.filter(s => Math.abs(s.y1 - y) < 0.4).sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2))
    let end = g.x
    for (const s of same) {
      if (Math.min(s.x1, s.x2) - end > 20) break
      end = Math.max(end, s.x1, s.x2)
    }
    const hook = segments.find(s => Math.abs(s.x1 - s.x2) < 0.3 && Math.abs(s.x1 - end) < 1.5 && Math.min(s.y1, s.y2) >= y - 12 && Math.max(s.y1, s.y2) <= y + 12)
    // una continuación "(8)" abarca desde el inicio del sistema; una 8va nueva empieza donde parte la línea
    const continuation = g.x < top.x1 + 70
    const lineStart = Math.min(...same.map(s => Math.min(s.x1, s.x2)))
    spans.push({ start: continuation ? g.x - 2 : lineStart - 5, end: hook ? hook.x1 + 1 : end, shift: above ? 12 : -12, staff })
  }
  return spans
}

/** Une dos notas iguales conectadas por una ligadura de prolongación (curva baja y delgada entre ambas cabezas). */
function mergeTies(notes: Note[], shapes: Shape[]): Note[] {
  const removed = new Set<Note>()
  const root = new Map<Note, Note>() // nota absorbida → nota que la contiene
  const resolve = (n: Note): Note => { let r = n; while (root.has(r)) r = root.get(r)!; return r }
  const curves = shapes.filter(c => c.curves && c.x2 - c.x1 >= 6 && c.x2 - c.x1 <= 140 && c.y2 - c.y1 <= 9)
    .sort((p, q) => p.x1 - q.x1)
  for (const curve of curves) {
    const mid = (curve.y1 + curve.y2) / 2
    const near = (n: Note, x: number, lo: number, hi: number) => n.x >= x - lo && n.x <= x + hi && Math.abs(n.y - mid) <= 14
    for (const a of notes.filter(n => near(n, curve.x1, 10, 2))) {
      const head = resolve(a)
      const end = head.startBeat + head.durationBeats
      const b = notes
        .filter(n => !removed.has(n) && n !== a && near(n, curve.x2, 2, 10) && n.midi === head.midi && n.hand === head.hand
          && n.page === head.page && Math.abs(n.startBeat - end) < 1e-3)
        .sort((p, q) => Math.abs(p.x - curve.x2) - Math.abs(q.x - curve.x2))[0]
      if (!b) continue
      head.durationBeats += b.durationBeats
      removed.add(b)
      root.set(b, head)
    }
  }
  return notes.filter(n => !removed.has(n))
}

/** Dos voces en unísono generan la misma nota dos veces: se deja una con la duración mayor. */
function dedupe(notes: Note[]): Note[] {
  const byKey = new Map<string, Note>()
  for (const n of notes) {
    const key = `${n.hand}|${n.midi}|${n.startBeat.toFixed(4)}`
    const prev = byKey.get(key)
    if (!prev) byKey.set(key, n)
    else prev.durationBeats = Math.max(prev.durationBeats, n.durationBeats)
  }
  return [...byKey.values()]
}

export function parsePage(page: PageData, systems: System[], ctx: ParseContext): PageResult {
  const notes: Note[] = []
  const warnings: Warning[] = []
  const lengths = new Map<number, number>()
  const repeats = noRepeats()
  const stems = page.segments.filter(s =>
    Math.abs(s.x1 - s.x2) < 0.2 && s.width > 0.3 && s.width < 0.6 && Math.abs(s.y2 - s.y1) > 8)
  const beams = page.shapes.filter(s => !s.curves && s.pts.length === 5)
  const flags = page.glyphs.filter(g => isOpusStd(g) && g.char in FLAG_LEVELS)

  // cada glifo pertenece al sistema más cercano verticalmente
  const distanceTo = (sys: System, y: number) => {
    const top = sys.staves[0].lines[0], bottom = sys.staves[1].lines[4]
    return y < top ? top - y : y > bottom ? y - bottom : 0
  }
  const owner = (g: Glyph) =>
    systems.reduce((best, sys, i) => (distanceTo(sys, g.y) < distanceTo(systems[best], g.y) ? i : best), 0)
  const glyphsOf = systems.map(() => [] as Glyph[])
  for (const g of page.glyphs) if (systems.length) glyphsOf[owner(g)].push(g)

  let measureBase = ctx.firstMeasure
  for (const [systemIndex, system] of systems.entries()) {
    const staves = system.staves
    const bar = system.barlines
    const glyphs = glyphsOf[systemIndex].filter(g => distanceTo(system, g.y) < 60)

    // claves por pentagrama
    const clefs: { x: number; clef: Clef }[][] = [[], []]
    for (const g of glyphs) {
      if (!isOpusStd(g) || (g.char !== '&' && g.char !== '?')) continue
      clefs[nearestStaff(staves, g.y)].push({ x: g.x, clef: g.char === '&' ? 'treble' : 'bass' })
    }
    clefs.forEach(c => c.sort((a, b) => a.x - b.x))
    const clefAt = (staff: number, x: number): Clef => {
      let cur: Clef = staff === 0 ? 'treble' : 'bass'
      for (const c of clefs[staff]) if (c.x <= x) cur = c.clef
      return cur
    }

    // cabezas de nota
    const heads: Head[] = []
    for (const g of glyphs) {
      if (!isOpusStd(g) || !(g.char in HEAD_BEATS) || g.size < MIN_GRACE_SIZE) continue
      const staff = nearestStaff(staves, g.y)
      const measure = measureOf(bar, g.x)
      if (measure < 0) continue
      const clef = clefAt(staff, g.x)
      heads.push({ g, staff, d: diatonicFromY(g.y, staves[staff], clef), clef, measure, acc: null, dotted: false, stem: null, up: false, shift: 0, grace: !isNormalSize(g) })
    }

    // 8va (mano derecha, sube) y 8vb (mano izquierda, baja)
    for (const o of findOttavas(glyphs, page.segments, staves)) {
      for (const h of heads) if (h.staff === o.staff && h.g.x >= o.start && h.g.x <= o.end) h.shift = o.shift
    }

    // plicas
    for (const h of heads) {
      if (h.g.char === 'w' || h.grace) continue
      // mejor plica candidata: la que contiene la cabeza, o la más cercana (hasta 10 pt) si la plica se acorta
      let best: { stem: Segment; up: boolean; penalty: number } | null = null
      for (const s of stems) {
        const top = Math.min(s.y1, s.y2), bottom = Math.max(s.y1, s.y2)
        const dx = s.x1 - h.g.x
        const outside = Math.max(0, top - h.g.y, h.g.y - bottom)
        let up: boolean | null = null
        if (dx > -1.2 && dx < 1.2 && h.g.y <= bottom - 8) up = false
        else if (dx > HEAD_WIDTH - 1.5 && dx < HEAD_WIDTH + 1.5 && h.g.y >= top + 8) up = true
        if (up === null || outside > 16) continue
        if (!best || outside < best.penalty) best = { stem: s, up, penalty: outside }
      }
      if (best) { h.stem = best.stem; h.up = best.up }
    }

    // cabezas desplazadas (segundas dentro de un acorde): comparten la plica de la cabeza vecina
    for (const h of heads) {
      if (h.stem || h.g.char === 'w' || h.grace) continue
      const sp = staves[h.staff].spacing
      const mate = heads.find(o =>
        o.stem && o.staff === h.staff && o.measure === h.measure
        && Math.abs(Math.abs(o.g.x - h.g.x) - HEAD_WIDTH) < 1.2
        && Math.abs(o.g.y - h.g.y) <= sp / 2 + 0.6)
      if (mate) { h.stem = mate.stem; h.up = mate.up }
    }

    // armadura (y sus cambios) + alteraciones locales
    const keyChanges: { from: number; key: KeySignature }[][] = [[], []]
    for (let st = 0; st < 2; st++) {
      const accs = glyphs
        .filter(g => isOpusStd(g) && g.char in ACCIDENTALS && g.size >= MIN_GRACE_SIZE && nearestStaff(staves, g.y) === st)
        .sort((a, b) => a.x - b.x)
      const used = new Set<Glyph>()
      const letterOf = (g: Glyph) => ((diatonicFromY(g.y, staves[st], clefAt(st, g.x)) % 7) + 7) % 7
      let current: KeySignature = new Map()
      for (let m = 0; m < bar.length - 1; m++) {
        const anchor = m === 0 ? (clefs[st][0]?.x ?? staves[st].x1) : bar[m]
        const reach = m === 0 ? 45 : 16
        const run: Glyph[] = []
        for (const a of accs) {
          if (used.has(a) || a.x < anchor - 1 || !isNormalSize(a)) continue
          const prevX = run.length ? run[run.length - 1].x : null
          if (prevX === null ? a.x - anchor > reach : a.x - prevX >= 8) break
          run.push(a)
        }
        const items = (list: Glyph[]) => list.map(g => ({ letter: letterOf(g), acc: ACCIDENTALS[g.char] }))
        // ¿la última alteración de la tira es de la primera nota del compás? entonces es local, no armadura
        const attachesToFirstHead = (g: Glyph) => {
          const mine = heads.filter(h => h.staff === st && h.measure === m)
          const first = mine.reduce<Head | null>((best, h) => (!best || h.g.x < best.g.x ? h : best), null)
          return !!first && first.d === diatonicFromY(g.y, staves[st], clefAt(st, g.x)) && first.g.x - g.x > 0 && first.g.x - g.x <= 14
        }
        for (let len = run.length; len >= (m === 0 ? 1 : 2); len--) {
          const prefix = run.slice(0, len)
          if (prefix.some(g => Math.abs(ACCIDENTALS[g.char]) > 1)) continue
          if (attachesToFirstHead(prefix[len - 1])) continue
          const next = applyKeySignatureRun(current, items(prefix))
          if (!next) continue
          current = next
          prefix.forEach(g => used.add(g))
          keyChanges[st].push({ from: m, key: new Map(next) })
          break
        }
      }
      for (const a of accs) {
        if (used.has(a)) continue
        const d = diatonicFromY(a.y, staves[st], clefAt(st, a.x))
        let best: Head | null = null
        for (const h of heads) {
          if (h.staff !== st || h.d !== d || h.acc !== null) continue
          const dx = h.g.x - a.x
          if (dx > 0 && dx < 24 && (!best || dx < best.g.x - a.x)) best = h
        }
        if (best) best.acc = ACCIDENTALS[a.char]
      }
    }
    const keyAt = (st: number, m: number): KeySignature => {
      let key: KeySignature = new Map()
      for (const c of keyChanges[st]) if (c.from <= m) key = c.key
      return key
    }

    // puntillos
    const dots = glyphs.filter(g => isOpusSpecial(g) && g.char === DOT)
    for (const h of heads) {
      if (h.grace) continue
      for (const d of dots) {
        const dx = d.x - h.g.x
        if (dx > 4 && dx < 17 && Math.abs(d.y - h.g.y) <= staves[h.staff].spacing * 0.8 && nearestStaff(staves, d.y) === h.staff) {
          h.dotted = true
        }
      }
    }

    // alteraciones por compás, en orden de aparición
    for (let st = 0; st < 2; st++) {
      const mine = heads.filter(h => h.staff === st)
      for (let m = 0; m < bar.length - 1; m++) {
        const state = new Map<number, Accidental>()
        for (const h of mine.filter(x => x.measure === m).sort((a, b) => a.g.x - b.g.x)) {
          if (h.acc !== null) state.set(h.d, h.acc)
          else if (state.has(h.d)) h.acc = state.get(h.d)!
          else h.acc = keyAt(st, m).get(((h.d % 7) + 7) % 7) ?? 0
        }
      }
    }

    // grupos (acordes / silencios) por pentagrama
    const groups: Group[] = []
    for (let st = 0; st < 2; st++) {
      const mine = heads.filter(h => h.staff === st && !h.grace)
      const byStem = new Map<Segment, Head[]>()
      const loose: Head[] = []
      for (const h of mine) {
        if (h.stem) byStem.set(h.stem, [...(byStem.get(h.stem) ?? []), h])
        else loose.push(h)
      }
      for (const [stem, hs] of byStem) {
        const up = hs[0].up
        const levels = beamLevels(stem, up, beams, flags)
        const base = hs.some(h => h.g.char === '˙') ? 2 : 1 / 2 ** levels
        const dotted = hs.some(h => h.dotted)
        groups.push({
          staff: st, measure: hs[0].measure, anchor: up ? stem.x1 - HEAD_WIDTH : stem.x1, heads: hs,
          nominal: base * (dotted ? 1.5 : 1), scale: 1, rest: false, up,
          y: up ? Math.min(stem.y1, stem.y2) : Math.max(stem.y1, stem.y2),
        })
      }
      loose.sort((a, b) => a.g.x - b.g.x)
      let cluster: Head[] = []
      const flush = () => {
        if (!cluster.length) return
        const base = Math.max(...cluster.map(h => HEAD_BEATS[h.g.char]))
        const dotted = cluster.some(h => h.dotted)
        groups.push({
          staff: st, measure: cluster[0].measure, anchor: cluster[0].g.x, heads: cluster,
          nominal: base * (dotted ? 1.5 : 1), scale: 1, rest: false, up: true, y: cluster[0].g.y,
        })
        cluster = []
      }
      for (const h of loose) {
        if (cluster.length && h.g.x - cluster[0].g.x > 7) flush()
        cluster.push(h)
      }
      flush()

      for (const g of glyphs) {
        if (!isOpusStd(g) || !(g.char in REST_BEATS) || nearestStaff(staves, g.y) !== st) continue
        const measure = measureOf(bar, g.x)
        if (measure < 0) continue
        const dotted = dots.some(d => d.x - g.x > 3 && d.x - g.x < 14 && Math.abs(d.y - g.y) < staves[st].spacing * 2 && nearestStaff(staves, d.y) === st)
        groups.push({
          staff: st, measure, anchor: g.x, heads: [], nominal: REST_BEATS[g.char] * (dotted ? 1.5 : 1), scale: 1, rest: true, up: g.y < staves[st].lines[2], y: g.y,
        })
      }
    }

    // glifos desconocidos en el centro del pentagrama (p. ej. silencio de blanca/redonda de otra fuente)
    for (let st = 0; st < 2; st++) {
      for (const g of glyphs) {
        if (!isOpusStd(g) || isKnownOpusChar(g.char) || !isNormalSize(g) || nearestStaff(staves, g.y) !== st) continue
        if (g.y < staves[st].lines[1] - 1 || g.y > staves[st].lines[3] + 1) continue
        const measure = measureOf(bar, g.x)
        if (measure < 0) continue
        if (groups.some(o => o.staff === st && o.measure === measure && !o.rest && Math.abs(o.anchor - g.x) < 9)) continue
        groups.push({
          staff: st, measure, anchor: g.x, heads: [], nominal: 0, scale: 1, rest: true, unknown: true,
          up: g.y < staves[st].lines[2], y: g.y,
        })
      }
    }

    // tresillos, quintillos, etc. (números de OpusTextStd)
    const digits = glyphs.filter(g => isOpusText(g) && /\d/.test(g.char) && g.size < 15).sort((a, b) => a.x - b.x)
    const numbers: TupletNumber[] = []
    for (const g of digits) {
      const last = numbers[numbers.length - 1]
      if (last && Math.abs(g.y - last.y) < 4 && g.x - last.x < 12 && last.n < 10) {
        last.n = last.n * 10 + Number(g.char)
      } else numbers.push({ n: Number(g.char), x: g.x + 3, y: g.y })
    }
    const allSeq = (st: number) => groups.filter(g => g.staff === st).sort((a, b) => a.anchor - b.anchor)
    applyTuplets(numbers, [allSeq(0), allSeq(1)])

    // tiempos por compás; si una mano no suma, se prueba con vigas cruzadas entre manos
    for (let m = 0; m < bar.length - 1; m++) {
      const measureNo = measureBase + m
      const inMeasure = groups.filter(g => g.measure === m)
      const perStaff = [0, 1].map(st => inMeasure.filter(g => g.staff === st).sort((a, b) => a.anchor - b.anchor))
      for (let st = 0; st < 2; st++) {
        const unknown = perStaff[st].filter(g => g.unknown)
        if (!unknown.length) continue
        if (unknown.length > 1) {
          warnings.push({ page: page.index, measure: measureBase + m, message: `${st === 0 ? 'Mano derecha' : 'Mano izquierda'}: hay silencios que no pude leer` })
          continue
        }
        const others = perStaff[st].filter(g => !g.unknown)
        const filled = others.length ? timeline(others).end : 0
        unknown[0].nominal = Math.max(0, ctx.beatsPerMeasure - filled)
      }
      const fits = (t: Timeline | null) => !t || Math.abs(t.end - ctx.beatsPerMeasure) <= 1e-3
      let timelines = perStaff.map(seq => (seq.length ? timeline(seq) : null))
      const here = numbers.filter(n => n.x >= bar[m] && n.x < bar[m + 1])
      for (let st = 0; st < 2; st++) {
        if (fits(timelines[st])) continue
        const alt = voiceSolve(perStaff[st], here, ctx.beatsPerMeasure)
        if (alt) timelines[st] = alt
      }

      if (!timelines.every(fits)) {
        const saved = inMeasure.map(g => g.scale)
        inMeasure.forEach(g => { g.scale = 1 })
        const merged = [...inMeasure].sort((a, b) => a.anchor - b.anchor)
        applyTuplets(here, [merged])
        const t = timeline(merged)
        if (fits(t)) timelines = [t, t]
        else inMeasure.forEach((g, i) => { g.scale = saved[i] })
      }

      const emitted = new Set<Group>()
      for (let st = 0; st < 2; st++) {
        const tl = timelines[st] ?? timeline(perStaff[st].length ? perStaff[st] : [])
        if (!perStaff[st].length) continue
        for (const g of perStaff[st]) {
          if (emitted.has(g)) continue
          emitted.add(g)
          const start = tl.starts.get(g) ?? 0
          const dur = g.nominal * g.scale
          ctx.debug?.({ measure: measureNo, staff: st, anchor: g.anchor, nominal: g.nominal, scale: g.scale, rest: g.rest, midi: g.heads.map(h => midiOf(h)), start, up: g.heads[0]?.up })
          for (const h of g.heads) {
            notes.push({
              midi: midiOf(h),
              startBeat: (measureNo - 1) * ctx.beatsPerMeasure + start,
              durationBeats: dur, hand: st === 0 ? 'R' : 'L',
              page: page.index, x: h.g.x + HEAD_WIDTH / 2, y: h.g.y, measure: measureNo,
              letter: ((h.d % 7) + 7) % 7, accidental: h.acc ?? 0,
            })
          }
        }
        // apoyaturas: suenan justo antes de la nota que las sigue, tomando su tiempo
        const graces = heads.filter(h => h.grace && h.staff === st && h.measure === m).sort((a, b) => a.g.x - b.g.x)
        const targets = perStaff[st].filter(g => !g.rest)
        const byTarget = new Map<Group, Head[]>()
        for (const h of graces) {
          const target = targets.filter(g => g.anchor >= h.g.x - 1).sort((a, b) => a.anchor - b.anchor)[0]
          if (target) byTarget.set(target, [...(byTarget.get(target) ?? []), h])
        }
        for (const [target, list] of byTarget) {
          const targetStart = tl.starts.get(target) ?? 0
          list.forEach((h, i) => {
            const absolute = (measureNo - 1) * ctx.beatsPerMeasure + targetStart - (list.length - i) * GRACE_BEATS
            notes.push({
              midi: midiOf(h), startBeat: Math.max(0, absolute), durationBeats: GRACE_BEATS,
              hand: st === 0 ? 'R' : 'L', page: page.index, x: h.g.x + HEAD_WIDTH / 2, y: h.g.y, measure: measureNo,
              letter: ((h.d % 7) + 7) % 7, accidental: h.acc ?? 0,
            })
          })
        }
        lengths.set(measureNo, Math.max(lengths.get(measureNo) ?? 0, tl.end))
        if (!fits(tl)) {
          warnings.push({
            page: page.index, measure: measureNo,
            message: `${st === 0 ? 'Mano derecha' : 'Mano izquierda'}: los tiempos suman ${+tl.end.toFixed(3)} y el compás pide ${ctx.beatsPerMeasure}`,
          })
        }
      }
    }
    const found = detectRepeats(page, system, measureBase)
    repeats.starts.push(...found.starts)
    repeats.ends.push(...found.ends)
    repeats.voltas.push(...found.voltas)
    measureBase += bar.length - 1
  }
  const merged = dedupe(mergeTies(notes, page.shapes))
  return { notes: merged, warnings, measures: measureBase - ctx.firstMeasure, lengths, repeats }
}
