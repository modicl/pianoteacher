import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseScore } from '../src/score-parser'

const pdf = () => new Uint8Array(readFileSync('tests/fixtures/national-park.pdf'))

test('tempo: negra = 86', async () => {
  expect((await parseScore(pdf())).tempoBpm).toBe(86)
})

test('compás 1, mano derecha: primer acorde y tresillo (verificado contra la partitura)', async () => {
  const { notes } = await parseScore(pdf())
  const m1 = notes.filter(n => n.measure === 1 && n.hand === 'R')
  const at = (beat: number) => m1.filter(n => Math.abs(n.startBeat - beat) < 1e-6).map(n => n.midi).sort((a, b) => a - b)
  expect(at(0)).toEqual([72, 75, 80])        // Do5 Mi♭5 La♭5
  expect(at(1)).toEqual([68])                 // La♭4 (primer tresillo)
  expect(at(2)).toEqual([71, 74, 80])         // Si♭♭ no: Do♭5 Mi𝄫5 La♭5
  expect(m1.find(n => n.midi === 80 && n.startBeat === 0)!.durationBeats).toBe(1)
})

test('compás 1, mano izquierda: dos blancas', async () => {
  const { notes } = await parseScore(pdf())
  const m1 = notes.filter(n => n.measure === 1 && n.hand === 'L')
  expect(m1.map(n => [n.midi, n.startBeat, n.durationBeats]).sort()).toEqual(
    [[40, 2, 2], [41, 0, 2], [52, 2, 2], [53, 0, 2]].sort())
})

test('la mayoría de los compases suman 4 tiempos', async () => {
  const score = await parseScore(pdf())
  expect(score.measures).toBe(43)
  expect(score.warnings.length).toBeLessThanOrEqual(8)
})

test('notas dentro del rango del piano', async () => {
  const { notes } = await parseScore(pdf())
  expect(notes.length).toBeGreaterThan(800)
  for (const n of notes) { expect(n.midi).toBeGreaterThanOrEqual(21); expect(n.midi).toBeLessThanOrEqual(108) }
})

test('PDF sin partitura lanza un error claro', async () => {
  const minimal = new TextEncoder().encode(
    '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
  await expect(parseScore(minimal)).rejects.toThrow()
})

test('8va (compases 3 a 4): las notas suenan una octava sobre lo escrito', async () => {
  const { notes } = await parseScore(pdf())
  // compás 4, mano derecha: Mi♭ escrito sobre el pentagrama (Mi♭6 = 87) → suena Mi♭7 = 99
  const m4 = notes.filter(n => n.measure === 4 && n.hand === 'R').map(n => n.midi)
  expect(Math.max(...m4)).toBeGreaterThanOrEqual(96)
  // compás 5 ya no está bajo la 8va
  const m5 = notes.filter(n => n.measure === 5 && n.hand === 'R').map(n => n.midi)
  expect(Math.max(...m5)).toBeLessThan(90)
})

test('8va: una nota anterior a la línea punteada no se desplaza (compás 3)', async () => {
  const { notes } = await parseScore(pdf())
  const m3 = notes.filter(n => n.measure === 3 && n.hand === 'R')
  const low = m3.find(n => Math.abs(n.x - (518 + 3.25)) < 3 && n.midi < 70)
  expect(low).toBeDefined()
  expect(low!.midi).toBeLessThan(60)       // no desplazada
  expect(Math.max(...m3.map(n => n.midi))).toBeGreaterThanOrEqual(96)
})

test('ligaduras de prolongación: Mi♭ del compás 9 se alarga hasta el compás 10', async () => {
  const { notes } = await parseScore(pdf())
  // compás 9: acorde de blanca con puntillo ligado a una nota del mismo compás → una sola nota larga
  const m9 = notes.filter(n => n.measure === 9 && n.hand === 'R')
  const longest = Math.max(...m9.map(n => n.durationBeats))
  expect(longest).toBeGreaterThan(3)
})

test('no hay dos notas iguales de la misma mano que empiecen a la vez', async () => {
  const { notes } = await parseScore(pdf())
  const seen = new Set<string>()
  for (const n of notes) {
    const k = `${n.hand}-${n.midi}-${n.startBeat.toFixed(4)}`
    expect(seen.has(k)).toBe(false)
    seen.add(k)
  }
})

test('ligaduras bien unidas: casi ninguna nota se solapa consigo misma (misma mano y altura)', async () => {
  const { notes } = await parseScore(pdf())
  const groups = new Map<string, typeof notes>()
  for (const n of notes) groups.set(`${n.hand}${n.midi}`, [...(groups.get(`${n.hand}${n.midi}`) ?? []), n])
  let overlaps = 0
  for (const list of groups.values()) {
    list.sort((a, b) => a.startBeat - b.startBeat)
    for (let i = 1; i < list.length; i++) {
      if (list[i].startBeat < list[i - 1].startBeat + list[i - 1].durationBeats - 1e-6) overlaps++
    }
  }
  // quedan solo voces distintas que repiten la misma altura (polifonía) y compases ya avisados; antes eran decenas
  expect(overlaps).toBeLessThanOrEqual(4)
})

test('semicorchea suelta con corchete doble (compás 35) no se lee como negra', async () => {
  const score = await parseScore(pdf())
  expect(score.warnings.some(w => w.measure === 35)).toBe(false)
})

test('dos voces en una mano con silencio oculto (compás 11): todos los compases suman', async () => {
  const score = await parseScore(pdf())
  expect(score.warnings.filter(w => w.measure === 11)).toEqual([])
})

test('toda la partitura de ejemplo se lee sin avisos de tiempo', async () => {
  const score = await parseScore(pdf())
  expect(score.warnings).toEqual([])
})

test('cifra de compás 4/4 leída del PDF', async () => {
  const score = await parseScore(pdf())
  expect(score.beatsPerMeasure).toBe(4)
})

test('las apoyaturas (notas pequeñas, p. 1 compás 7) suenan como notas cortas de 1/8 de pulso', async () => {
  const { notes } = await parseScore(pdf())
  const grace = notes.filter(n => n.page === 0 && n.durationBeats === 0.125 && Math.abs(n.x - (297 + 3.25)) < 1)
  expect(grace).toHaveLength(1)
  // las tres apoyaturas terminan justo cuando empieza la nota que las sigue
  const group = notes.filter(n => n.page === 0 && n.durationBeats === 0.125 && n.x > 290 && n.x < 320 && n.y > 380 && n.y < 430)
  expect(group.length).toBe(3)
  const starts = group.map(n => n.startBeat).sort((a, b) => a - b)
  expect(starts[1] - starts[0]).toBeCloseTo(0.125)
  expect(starts[2] - starts[1]).toBeCloseTo(0.125)
})

test('repeticiones: inicio en el compás 8, final en el 41, casillas 1 (c.41) y 2 (c.42)', async () => {
  const score = await parseScore(pdf())
  expect(score.repeats.starts).toEqual([8])
  expect(score.repeats.ends).toEqual([41])
  expect(score.repeats.voltas).toEqual([{ number: 1, measure: 41 }, { number: 2, measure: 42 }])
})

test('orden de reproducción: 1-41, luego 8-40 (repetición), luego 42 y 43', async () => {
  const score = await parseScore(pdf())
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  expect(score.order).toEqual([...range(1, 41), ...range(8, 40), 42, 43])
  expect(score.occurrenceStarts).toHaveLength(score.order.length)
})

test('reproducción desenrollada: las notas del compás 8 aparecen dos veces', async () => {
  const score = await parseScore(pdf())
  const m8 = score.playback.filter(n => n.measure === 8)
  const written = score.notes.filter(n => n.measure === 8)
  expect(m8.length).toBe(written.length * 2)
  // la segunda pasada empieza justo después del compás 41
  const second = Math.min(...m8.filter(n => n.startBeat > score.measureStarts[40]).map(n => n.startBeat))
  expect(second).toBeCloseTo(score.measureStarts[40] + 4, 5)
})

test('cada nota trae su escritura: la armadura de bemoles no produce sostenidos', async () => {
  const { notes } = await parseScore(pdf())
  expect(notes.every(n => typeof n.letter === 'number' && typeof n.accidental === 'number')).toBe(true)
  expect(notes.filter(n => (n.accidental ?? 0) > 0)).toHaveLength(0)
  // Sol♭ (Fa♯) es la tecla negra 66/78/...: en esta partitura siempre se escribe Sol♭
  const blackG = notes.filter(n => n.midi % 12 === 6)
  expect(blackG.length).toBeGreaterThan(0)
  expect(blackG.every(n => n.letter === 4 && n.accidental === -1)).toBe(true)
})

test('acorde del compás 1 con su ortografía: Do♭5, Mi𝄫5 (Mi♭♭) y La♭5', async () => {
  const { notes } = await parseScore(pdf())
  const chord = notes.filter(n => n.measure === 1 && n.hand === 'R' && Math.abs(n.startBeat - 2) < 1e-6)
  const spelled = chord.map(n => [n.letter, n.accidental]).sort()
  expect(spelled).toEqual([[0, -1], [2, -2], [5, -1]])
})
