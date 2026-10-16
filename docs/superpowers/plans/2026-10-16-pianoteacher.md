# PianoTeacher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app que lee una partitura de piano en PDF vectorial, extrae las notas y las reproduce iluminando las teclas de un piano en pantalla.

**Architecture:** Parser determinista en el navegador: pdf.js entrega glifos (fuente Opus) y trazos → pentagramas → notas (MIDI + beats). Un reloj de reproducción emite notas activas que consumen el teclado, el audio y el cursor sobre la página renderizada.

**Tech Stack:** Vite, React 18, TypeScript, pdfjs-dist, Vitest, Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-16-pianoteacher-design.md`

## Global Constraints

- UI en español latino neutro (esMX); código e identificadores en inglés.
- Todo corre en el navegador, sin backend.
- Fixture de prueba: `C:\Users\Villa\Downloads\Pokemon HGSS OST - National Park.pdf` (Sibelius, 4 páginas, fuentes OpusStd/OpusSpecialStd/OpusTextStd).
- Si un compás no cuadra, emitir advertencia; nunca inventar notas.
- Sin git en la carpeta: omitir pasos de commit salvo que se ejecute `git init`.

## Review Focus

- PDF que no es partitura vectorial (escaneo, texto cualquiera): mensaje claro, sin crash.
- Compás cuyos beats no suman el compás: advertencia visible, notas igual reproducibles.
- Acordes (varias notas en el mismo x): todas las teclas se iluminan a la vez.
- Alteraciones (♭ ♯ ♮): duran todo el compás y se reinician en la barra.
- Nota fuera del rango del piano o cambio de clave a mitad de pieza: no rompe el teclado.

---

## Datos medidos del PDF (página 1, usados por las pruebas)

- Tamaño 596×842 pt. Separación entre líneas del pentagrama ≈ 4.745 pt.
- Cabezas de nota: `œ` (negra o menor), `˙` (blanca), `w` (redonda) en fuente `OpusStd`; `b`/`n` = bemol/becuadro; `&` clave de sol; `?` clave de fa; `∫` y `J` aparecen en el resto de la partitura (validar en la Tarea 3).
- `OpusSpecialStd`: `{` llave, `∏`/`™` silencios y símbolos.
- Los pentagramas son 5 trazos horizontales; las barras de compás son trazos verticales (ancho 0.74) que cruzan un pentagrama.

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tests/fixtures/national-park.pdf`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: proyecto con `npm run dev`, `npm test`.

- [ ] **Step 1: Crear el proyecto**

```bash
cd "C:/Users/Villa/Documents/Proyectos React/pianoteacher"
npm create vite@latest . -- --template react-ts
npm install
npm install pdfjs-dist
npm install -D vitest
mkdir -p tests/fixtures
cp "C:/Users/Villa/Downloads/Pokemon HGSS OST - National Park.pdf" tests/fixtures/national-park.pdf
```

(Si Vite pregunta por carpeta no vacía, elegir "Ignore files and continue"; conservar `README.md` y `docs/`.)

- [ ] **Step 2: Agregar script de pruebas y prueba de humo**

En `package.json` agregar `"test": "vitest run"`. Crear `tests/smoke.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { expect, test } from 'vitest'

test('fixture existe', () => {
  expect(existsSync('tests/fixtures/national-park.pdf')).toBe(true)
})
```

- [ ] **Step 3: Verificar**

Run: `npm test` → PASS. Run: `npm run build` → sin errores.

---

### Task 2: Extraer primitivas del PDF (glifos y trazos)

**Files:**
- Create: `src/score-parser/types.ts`, `src/score-parser/extract.ts`
- Test: `tests/extract.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export interface Glyph { char: string; font: string; x: number; y: number; size: number } // y hacia abajo, en pt
export interface Segment { x1: number; y1: number; x2: number; y2: number; width: number }
export interface PageData { index: number; width: number; height: number; glyphs: Glyph[]; segments: Segment[] }
// extract.ts
export function extractPage(pdfData: Uint8Array, pageIndex: number): Promise<PageData>
export function pageCount(pdfData: Uint8Array): Promise<number>
```

- [ ] **Step 1: Prueba que falla**

```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { extractPage, pageCount } from '../src/score-parser/extract'

const pdf = new Uint8Array(readFileSync('tests/fixtures/national-park.pdf'))

test('4 páginas', async () => { expect(await pageCount(pdf)).toBe(4) })

test('página 1 tiene los glifos y trazos esperados', async () => {
  const p = await extractPage(pdf, 0)
  expect(Math.round(p.width)).toBe(596)
  expect(p.glyphs.filter(g => g.char === 'œ').length).toBeGreaterThan(250)
  const horizontal = p.segments.filter(s => Math.abs(s.y1 - s.y2) < 0.5)
  expect(horizontal.length).toBeGreaterThan(200)
})
```

- [ ] **Step 2:** Run `npm test -- extract` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar `extract.ts`**

Usar `pdfjs-dist/legacy/build/pdf.mjs` en Node (en el navegador `pdfjs-dist`). Glifos: `page.getTextContent()`; cada item trae `str`, `transform` ([a,b,c,d,e,f], con `e,f` = origen en coordenadas PDF) y `fontName`; el nombre real de la fuente se obtiene de `page.commonObjs.get(fontName).name`. Si un item trae varios caracteres, repartirlos con el ancho del item (`item.width / str.length`). Convertir `y = viewport.height - f`. Trazos: `page.getOperatorList()`, recorrer `OPS.constructPath` (con `OPS.moveTo`/`OPS.lineTo`/`OPS.rectangle` dentro de `args[0]`) manteniendo la matriz con `OPS.save/restore/transform`; cada `moveTo→lineTo` produce un `Segment`; un `rectangle` delgado (alto < 1 pt) produce un segmento horizontal y uno delgado en ancho produce uno vertical; `OPS.setLineWidth` fija `width`.

- [ ] **Step 4:** Run `npm test -- extract` → PASS. Si los conteos no coinciden, imprimir los datos y ajustar el extractor (la fuente de verdad son los números de "Datos medidos").

---

### Task 3: Detectar pentagramas, llaves y compases

**Files:**
- Create: `src/score-parser/staves.ts`
- Test: `tests/staves.test.ts`

**Interfaces:**
- Consumes: `PageData`.
- Produces:

```ts
export interface Staff { lines: number[] /* 5 y's, de arriba a abajo */; spacing: number; x1: number; x2: number }
export interface System { staves: [Staff, Staff]; barlines: number[] /* x ordenadas, sin duplicados */ }
export function detectSystems(page: PageData): System[]
```

- [ ] **Step 1: Prueba**

```ts
test('página 1: sistemas de 2 pentagramas, spacing ≈ 4.745', async () => {
  const p = await extractPage(pdf, 0)
  const systems = detectSystems(p)
  expect(systems.length).toBeGreaterThanOrEqual(3)
  for (const s of systems) {
    expect(s.staves[0].lines).toHaveLength(5)
    expect(s.staves[0].spacing).toBeCloseTo(4.745, 1)
    expect(s.barlines.length).toBeGreaterThanOrEqual(2)
  }
})
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implementar**

1. Segmentos horizontales con longitud > 100 pt, agrupar por `y` redondeado a 0.1.
2. Recorrer las `y` ordenadas y juntar 5 consecutivas con diferencia ≈ constante (±0.3) → `Staff`.
3. Emparejar pentagramas consecutivos de a dos → `System` (el primero es mano derecha, el segundo izquierda).
4. Barras de compás: segmentos verticales con `width ≈ 0.74` cuyo rango y cubra el pentagrama completo; deduplicar con tolerancia 0.5 pt.

- [ ] **Step 4:** Run → PASS.

---

### Task 4: Mapear posición a nota (clave, armadura, alteraciones)

**Files:**
- Create: `src/score-parser/pitch.ts`
- Test: `tests/pitch.test.ts`

**Interfaces:**
- Produces:

```ts
export type Clef = 'treble' | 'bass'
export function diatonicFromY(y: number, staff: Staff, clef: Clef): number // índice diatónico: octava*7 + {C0,D1,E2,F3,G4,A5,B6}
export function midiFromDiatonic(d: number, accidental: -1 | 0 | 1): number
export function noteName(midi: number, style: 'letters' | 'solfege'): string
```

- [ ] **Step 1: Pruebas (puras)**

```ts
const staff = { lines: [100, 104.75, 109.5, 114.25, 119], spacing: 4.75, x1: 0, x2: 500 }

test('sol: línea inferior es E4', () => {
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'treble'), 0)).toBe(64)
})
test('sol: espacio sobre la línea superior (y=97.625) es G5', () => {
  expect(midiFromDiatonic(diatonicFromY(97.625, staff, 'treble'), 0)).toBe(79)
})
test('fa: línea inferior es G2', () => {
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'bass'), 0)).toBe(43)
})
test('bemol baja un semitono', () => {
  expect(midiFromDiatonic(diatonicFromY(119, staff, 'treble'), -1)).toBe(63)
})
test('nombres', () => {
  expect(noteName(60, 'letters')).toBe('C4')
  expect(noteName(61, 'solfege')).toBe('Do♯4')
})
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implementar**

```ts
const SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const BOTTOM = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 } // E4, G2

export function diatonicFromY(y: number, staff: Staff, clef: Clef) {
  const bottom = staff.lines[4]
  const step = Math.round((bottom - y) / (staff.spacing / 2))
  return BOTTOM[clef] + step
}
export function midiFromDiatonic(d: number, accidental: -1 | 0 | 1) {
  const oct = Math.floor(d / 7)
  return 12 * (oct + 1) + SEMITONES[((d % 7) + 7) % 7] + accidental
}
const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
export function noteName(midi: number, style: 'letters' | 'solfege') {
  const base = (style === 'letters' ? LETTERS : SOLFEGE)[midi % 12]
  return `${base}${Math.floor(midi / 12) - 1}`
}
```

- [ ] **Step 4:** Run → PASS.

- [ ] **Step 5: Calibración con el PDF real.** Agregar una prueba que, para todas las cabezas de nota `œ/˙/w` de la página 1 (usar `glyph.y` de `extractPage`), verifique que `(staff.lines[4] - (glyph.y + offset)) / (spacing/2)` queda a menos de 0.15 de un entero. Encontrar `offset` (la distancia entre el origen del glifo y el centro de la cabeza) probando hasta que el 100% de las cabezas cumpla; guardar `NOTEHEAD_Y_OFFSET` como constante en `pitch.ts` y usarla en la Tarea 6.

---

### Task 5: Claves, armadura y alteraciones

**Files:**
- Create: `src/score-parser/context.ts`
- Test: `tests/context.test.ts`

**Interfaces:**
- Consumes: `PageData`, `System`.
- Produces:

```ts
export function detectClef(page: PageData, staff: Staff): Clef            // '&' = treble, '?' = bass, a la izquierda de la armadura
export function detectKeySignature(page: PageData, staff: Staff, clef: Clef): Map<number, -1 | 1> // letra diatónica (0..6) → alteración
export function accidentalsForMeasure(page: PageData, staff: Staff, x1: number, x2: number): { x: number; d: number; acc: -1 | 0 | 1 }[]
```

- [ ] **Step 1: Pruebas.** En la página 1: pentagrama superior de cada sistema → `treble`, inferior → `bass`. La armadura de la pieza se verifica leyendo los glifos `b`/`#` entre la clave y la primera barra; el resultado esperado se confirma a mano mirando la partitura (abrir con el visor de PDF) y se escribe en la prueba.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar.** `detectClef`: glifo `&` o `?` dentro de `staff` con `x < staff.x1 + 40`. Armadura: glifos `b` (bemol) / `#` (sostenido) con x entre la clave y el primer glifo de nota; su `d` se calcula con `diatonicFromY`; guardar `d % 7 → ±1`. Alteraciones locales: glifos `b`, `#`, `n` dentro del rango x del compás; `acc` = -1, 1, 0; asociar a la nota a su derecha más cercana en el mismo `d`.
- [ ] **Step 4:** Run → PASS.

---

### Task 6: Notas con duración y modelo de partitura

**Files:**
- Create: `src/score-parser/notes.ts`, `src/score-parser/index.ts`
- Test: `tests/notes.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:

```ts
export interface Note { midi: number; startBeat: number; durationBeats: number; hand: 'R' | 'L'; page: number; x: number; y: number; measure: number }
export interface Warning { page: number; measure: number; message: string }
export interface Score { notes: Note[]; tempoBpm: number; beatsPerMeasure: number; warnings: Warning[]; pageCount: number }
export function parseScore(pdfData: Uint8Array): Promise<Score>
```

- [ ] **Step 1: Prueba con los primeros compases.** Leer la partitura a mano (primeros 2 compases de cada mano), y escribir en la prueba el arreglo esperado de `{midi, startBeat, durationBeats, hand}`. Además:

```ts
test('los beats de cada compás suman el compás', async () => {
  const score = await parseScore(pdf)
  expect(score.warnings).toEqual([])   // si hay advertencias legítimas, documentarlas aquí una por una
  expect(score.notes.length).toBeGreaterThan(100)
  expect(score.tempoBpm).toBeGreaterThan(30)
})

test('PDF que no es partitura lanza error claro', async () => {
  await expect(parseScore(new Uint8Array(/* PDF mínimo sin pentagramas */)))
    .rejects.toThrow('no parece una partitura')
})
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar.**
  1. Por sistema y por mano: tomar glifos `œ ˙ w` dentro del pentagrama, calcular `d` con `diatonicFromY` (usando `NOTEHEAD_Y_OFFSET`), aplicar armadura y alteraciones locales (reiniciar en cada barra de compás).
  2. Duración base: `w`=4, `˙`=2, `œ`=1. Para `œ`: si hay plica con corchete (`J`/`∫`…) o barra gruesa (segmento con `width > 1.5` cerca de la plica) → 0.5; dos barras → 0.25. Puntillo: glifo `.` a la derecha de la cabeza y en el mismo espacio → ×1.5. Las constantes de glifos y barras se fijan observando los glifos reales (imprimir los `char` de `OpusStd`/`OpusSpecialStd` por página y mapearlos una sola vez en `GLYPHS` dentro de `notes.ts`).
  3. Silencios: glifos de `OpusSpecialStd` (`∏`, `™`…) avanzan el tiempo sin generar nota.
  4. Posición temporal: dentro de un compás, ordenar columnas (x) y acumular duración; acordes = misma columna (|Δx| < 3 pt) comparten `startBeat`. Las dos manos se alinean porque cada una acumula desde el inicio del compás.
  5. `measure` global = contador de compases entre sistemas y páginas. `beatsPerMeasure` desde el texto de compás (`OpusTextStd` dígitos) y `tempoBpm` desde `q = N` (texto `PlantinMTStd`).
  6. Validación: si la suma de beats de una mano en un compás ≠ `beatsPerMeasure` (tolerancia 1e-6), agregar `Warning`.
  7. Si ninguna página tiene `System`s, lanzar `Error('Este PDF no parece una partitura vectorial')`.
- [ ] **Step 4:** Run → PASS. Iterar sobre las advertencias hasta que la fixture quede limpia o cada una esté justificada (p. ej. anacrusa).

---

### Task 7: Reloj de reproducción

**Files:**
- Create: `src/playback/clock.ts`
- Test: `tests/clock.test.ts`

**Interfaces:**
- Consumes: `Note`.
- Produces:

```ts
export function activeNotes(notes: Note[], beat: number): Note[]   // startBeat <= beat < startBeat + durationBeats
export function beatToSeconds(beat: number, bpm: number, speed: number): number
export class Transport {
  constructor(notes: Note[], bpm: number)
  speed: number; position: number; playing: boolean
  play(): void; pause(): void; seekMeasure(m: number, beatsPerMeasure: number): void
  tick(dtSeconds: number): void      // avanza position
  onNoteOn?: (n: Note) => void; onNoteOff?: (n: Note) => void
}
```

- [ ] **Step 1: Pruebas**

```ts
const n = (midi: number, s: number, d: number): Note =>
  ({ midi, startBeat: s, durationBeats: d, hand: 'R', page: 0, x: 0, y: 0, measure: 0 })

test('activeNotes respeta el intervalo semiabierto', () => {
  const notes = [n(60, 0, 1), n(62, 1, 1)]
  expect(activeNotes(notes, 0.5).map(x => x.midi)).toEqual([60])
  expect(activeNotes(notes, 1).map(x => x.midi)).toEqual([62])
})
test('Transport dispara noteOn/noteOff una vez', () => {
  const t = new Transport([n(60, 0, 1)], 60)
  const on: number[] = [], off: number[] = []
  t.onNoteOn = x => on.push(x.midi); t.onNoteOff = x => off.push(x.midi)
  t.play(); t.tick(0.5); t.tick(0.6)
  expect(on).toEqual([60]); expect(off).toEqual([60])
})
test('speed 0.5 duplica la duración real', () => {
  expect(beatToSeconds(1, 60, 0.5)).toBe(2)
})
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar** `beatToSeconds = beat * 60 / bpm / speed`; `Transport.tick` avanza `position += dt * bpm / 60 * speed`, calcula el conjunto activo antes y después, y emite `onNoteOn` para nuevos y `onNoteOff` para los que salen; pausa al pasar la última nota.
- [ ] **Step 4:** Run → PASS.

---

### Task 8: Audio de piano

**Files:**
- Create: `src/playback/piano-audio.ts`
- Test: `tests/piano-audio.test.ts`

**Interfaces:**
- Produces:

```ts
export function midiToFrequency(midi: number): number
export class PianoAudio { noteOn(midi: number): void; noteOff(midi: number): void }
```

- [ ] **Step 1: Prueba:** `expect(midiToFrequency(69)).toBe(440)` y `expect(midiToFrequency(60)).toBeCloseTo(261.63, 1)`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar.** `440 * 2 ** ((midi - 69) / 12)`. `PianoAudio` crea un `AudioContext` perezoso; `noteOn` genera 2 osciladores (triangle + sine una octava arriba al 30%) con envolvente (ataque 5 ms, decaimiento exponencial a 0.3 en 0.4 s, sostenido bajo); `noteOff` aplica release de 0.25 s. Guardar los nodos por `midi` en un `Map` para poder cortarlos.
- [ ] **Step 4:** Run → PASS.

---

### Task 9: Teclado de piano

**Files:**
- Create: `src/ui/PianoKeyboard.tsx`, `src/ui/piano-layout.ts`, `src/ui/PianoKeyboard.css`
- Test: `tests/piano-layout.test.ts`

**Interfaces:**
- Consumes: `noteName`.
- Produces:

```ts
export interface Key { midi: number; black: boolean; index: number /* posición entre teclas blancas */ }
export function buildKeys(lowMidi?: number, highMidi?: number): Key[]  // default 21..108
// <PianoKeyboard active={Map<number,'R'|'L'>} labels={'letters'|'solfege'|'none'} />
```

- [ ] **Step 1: Pruebas:** `buildKeys()` → longitud 88; 52 blancas y 36 negras; `buildKeys()[0].midi === 21`; el midi 60 es blanca.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar.** Blancas posicionadas con CSS grid/`left = index * w`; negras en absoluto sobre el borde derecho de la blanca anterior. Color de iluminación: mano derecha `#3b82f6`, mano izquierda `#f97316`. Etiqueta con `noteName` solo en teclas activas (y todas las blancas si `labels !== 'none'`, tamaño pequeño). Desplazamiento horizontal automático para que las teclas activas queden visibles en pantallas angostas.
- [ ] **Step 4:** Run → PASS.

---

### Task 10: Vista de partitura con cursor

**Files:**
- Create: `src/ui/ScoreView.tsx`

**Interfaces:**
- Consumes: `Score`, `Transport.position`.
- Produces: `<ScoreView pdfData page notes activeNotes />` — renderiza la página en un `<canvas>` con `page.render`, y superpone un `<div>` absoluto: un resaltado sobre cada nota activa en `(note.x, note.y)` escalado, y cambio automático de página cuando la nota activa está en otra.

- [ ] **Step 1: Implementar** con `pdfjs-dist` en el navegador (`GlobalWorkerOptions.workerSrc` con `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`), escala fija 1.4, y `devicePixelRatio` para nitidez.
- [ ] **Step 2: Verificar** con `npm run dev` (tarea 11 lo integra): las marcas deben caer sobre las cabezas de nota.

---

### Task 11: App integrada

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Implementar** la pantalla en esMX:
  - Zona de carga: "Sube tu partitura en PDF" (input file + arrastrar y soltar).
  - Tras `parseScore`: barra de advertencias ("Compás 12: los tiempos no suman…"), `ScoreView` a la izquierda/arriba y `PianoKeyboard` abajo, siempre visible.
  - Controles: Reproducir/Pausar, velocidad (0.25×–1.5×), saltar al compás, alternar etiquetas (Letras / Solfeo / Ninguna), alternar sonido.
  - Bucle con `requestAnimationFrame` que llama `transport.tick(dt)` y actualiza `active` (Map midi→mano).
  - Cargar por defecto nada; botón "Probar con National Park" que hace `fetch('/national-park.pdf')` (copiar el fixture a `public/`).
- [ ] **Step 2: Verificación manual.** `npm run dev`, abrir con el navegador, cargar la partitura y comprobar: las teclas se iluminan al compás del cursor; las manos tienen colores distintos; las advertencias se muestran si existen; un PDF cualquiera muestra "Este PDF no parece una partitura vectorial".
- [ ] **Step 3:** `npm test` y `npm run build` sin errores.

---

## Self-Review

- Cobertura de la spec: parser (T2–T6), reproducción (T7–T8), teclado (T9), vista (T10), flujo y errores (T11), pruebas con fixture (T2–T6). "Esperar mi tecla" queda fuera de la v1 según la spec.
- Tipos consistentes: `Note`, `Staff`, `System`, `PageData`, `Clef` se definen una vez y se reutilizan con los mismos nombres.
- Riesgo: las tareas 5 y 6 dependen de mapear glifos reales; sus pasos indican cómo fijar la tabla observando la fixture, y la validación de compases detecta errores.
