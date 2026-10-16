import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Score } from './score-parser'
import { Transport, activeNotes as notesAt } from './playback/clock'
import { PianoAudio } from './playback/piano-audio'
import { occurrenceAt } from './playback/position'
import { friendlyError } from './errors'
import { spellNote } from './score-parser/names'
import { labelsForPage } from './ui/note-labels'
import { PianoKeyboard, type LabelMode } from './ui/PianoKeyboard'
import { ScoreView } from './ui/ScoreView'
import './App.css'

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5]

export default function App() {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [score, setScore] = useState<Score | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<Map<number, 'R' | 'L'>>(new Map())
  const [activeNotes, setActiveNotes] = useState<Score['notes']>([])
  const [playing, setPlaying] = useState(false)
  const [measure, setMeasure] = useState(1)
  const [page, setPage] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [labels, setLabels] = useState<LabelMode>('solfege')
  const [sound, setSound] = useState(true)
  const [showWarnings, setShowWarnings] = useState(false)
  const [dragging, setDragging] = useState(false)
  // nombres de las notas sobre la partitura (se recuerda la preferencia)
  const [showNames, setShowNames] = useState(() => {
    try { return localStorage.getItem('pianoteacher.showNames') !== '0' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('pianoteacher.showNames', showNames ? '1' : '0') } catch { /* sin almacenamiento */ }
  }, [showNames])

  const transport = useRef<Transport | null>(null)
  const audio = useRef(new PianoAudio())
  const loadId = useRef(0)

  const load = useCallback(async (data: Uint8Array) => {
    const id = ++loadId.current
    setLoading(true)
    setError(null)
    try {
      // el lector de PDF (pdf.js) pesa mucho: se baja recién al abrir una partitura, así la pantalla aparece enseguida
      const { loadParser } = await import('./pdf-loader')
      const parsed = await (await loadParser()).parseScore(data)
      if (id !== loadId.current) return // llegó una carga más nueva
      transport.current?.pause()
      audio.current.stopAll()
      setPlaying(false)
      setPdfData(data)
      setScore(parsed)
      setMeasure(1)
      setPage(0)
    } catch (e) {
      // si falla, se conserva la partitura que ya estaba cargada
      if (id === loadId.current) setError(friendlyError(e))
    } finally {
      if (id === loadId.current) setLoading(false)
    }
  }, [])

  const loadFile = useCallback(async (file: File) => {
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      setError('El archivo debe ser un PDF')
      return
    }
    try {
      await load(new Uint8Array(await file.arrayBuffer()))
    } catch {
      setError('No se pudo leer el archivo')
    }
  }, [load])

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch('/national-park.pdf')
      if (!res.ok) throw new Error('descarga')
      await load(new Uint8Array(await res.arrayBuffer()))
    } catch {
      setError('No se pudo cargar la partitura de ejemplo')
    }
  }, [load])

  // un reloj nuevo por partitura (suena la versión desenrollada: con repeticiones)
  useEffect(() => {
    if (!score) { transport.current = null; return }
    const t = new Transport(score.playback, score.tempoBpm)
    t.speed = speed
    t.onNoteOn = n => audio.current.noteOn(n, n.midi)
    t.onNoteOff = n => audio.current.noteOff(n)
    t.onEnd = () => setPlaying(false)
    transport.current = t
    setActive(new Map()); setActiveNotes([])
    return () => { t.pause(); audio.current.stopAll() }
    // la velocidad se aplica en su propio efecto; aquí solo se parte con la actual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score])

  useEffect(() => { if (transport.current) transport.current.speed = speed }, [speed])
  useEffect(() => {
    audio.current.enabled = sound
    if (!sound) audio.current.stopAll()
  }, [sound])

  // bucle de animación
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = transport.current
      if (!t) return
      t.tick(Math.min((now - last) / 1000, 0.1))
      last = now
      const notes = t.activeNow
      setActiveNotes(notes)
      setActive(prev => {
        const next = new Map<number, 'R' | 'L'>()
        for (const n of notes) next.set(n.midi, n.hand)
        const same = prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v)
        return same ? prev : next
      })
      if (score) {
        setMeasure(score.order[occurrenceAt(score.occurrenceStarts, t.position)] ?? 1)
        const lead = notes[0] ?? score.playback.find(n => n.startBeat >= t.position)
        if (lead) setPage(lead.page)
      }
      if (t.playing) raf = requestAnimationFrame(frame)
      else { setPlaying(false); setActive(new Map()); setActiveNotes([]) }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing, score])

  /** Muestra en el teclado y en la partitura estas notas (sin tocar el audio). */
  const show = (notes: Score['notes']) => {
    setActiveNotes(notes)
    const next = new Map<number, 'R' | 'L'>()
    for (const n of notes) next.set(n.midi, n.hand)
    setActive(next)
  }

  const togglePlay = () => {
    const t = transport.current
    if (!t) return
    if (playing) { const shown = t.activeNow; t.pause(); setPlaying(false); show(shown) } // pausa: se silencia, pero se siguen viendo
    else { audio.current.unlock(); t.play(); setPlaying(true) }
  }

  const goTo = (m: number) => {
    if (!score || !transport.current) return
    const clamped = Math.min(Math.max(1, Math.round(m) || 1), score.measures)
    const index = Math.max(0, score.order.indexOf(clamped))
    audio.current.stopAll()
    transport.current.seek(score.occurrenceStarts[index] ?? 0)
    setMeasure(clamped)
    const first = score.notes.find(n => n.measure >= clamped)
    if (first) setPage(first.page)
    show(notesAt(score.playback, score.occurrenceStarts[index] ?? 0))
  }

  const jumpWarnings = useMemo(() => score?.warnings ?? [], [score])

  const hasWarnings = jumpWarnings.length > 0

  // nombres con la escritura de la partitura (Sol♭ con armadura de bemoles); "Ninguno" solo oculta los del teclado
  const nameStyle = labels === 'letters' ? 'letters' : 'solfege'
  const keyNames = useMemo(() => {
    const names = new Map<number, string>()
    for (const n of activeNotes) names.set(n.midi, spellNote(n, nameStyle))
    return names
  }, [activeNotes, nameStyle])
  const noteLabels = useMemo(
    () => (showNames && score ? labelsForPage(score.notes, page, nameStyle) : []),
    [showNames, score, page, nameStyle],
  )

  return (
    <div
      className={`app${dragging ? ' dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void loadFile(f) }}
    >
      <header className="bar">
        <h1>PianoTeacher</h1>
        <label className="button">
          Subir PDF
          <input type="file" accept="application/pdf,.pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = '' }} />
        </label>
        <button className="ghost" onClick={() => void loadSample()}>National Park</button>
        <span className="spacer" />
        {score && (
          <>
            <nav className="pages" aria-label="Páginas">
              {Array.from({ length: score.pageCount }, (_, i) => (
                <button key={i} className={i === page ? 'on' : ''} onClick={() => setPage(i)} aria-label={`Página ${i + 1}`}>{i + 1}</button>
              ))}
            </nav>
            <span className="legend"><i className="dot right" />Derecha <i className="dot left" />Izquierda</span>
            {hasWarnings && (
              <button className="ghost warn" onClick={() => setShowWarnings(v => !v)} aria-expanded={showWarnings}>
                ⚠ {jumpWarnings.length}
              </button>
            )}
          </>
        )}
      </header>

      {showWarnings && hasWarnings && (
        <section className="warnings" aria-label="Avisos de lectura">
          <p className="muted">Compases que no pude leer del todo bien. Toca uno para saltar a él.</p>
          <ul>
            {jumpWarnings.map((w, i) => (
              <li key={i}><button className="link" onClick={() => { goTo(w.measure); setShowWarnings(false) }}>Compás {w.measure}</button> — {w.message}</li>
            ))}
          </ul>
        </section>
      )}

      {loading && <p className="status">Leyendo la partitura…</p>}
      {error && <p className="status error" role="alert">{error}</p>}

      {!score && !loading && !error && (
        <section className="empty">
          <h2>Aprende a leer la partitura viendo el piano</h2>
          <p>Sube una partitura de piano en PDF (exportada desde Sibelius) o arrastra el archivo aquí. Las teclas se iluminan cuando llega cada nota.</p>
        </section>
      )}

      {score && pdfData && (
        <>
          <section className="transport" aria-label="Controles">
            <button className="primary" onClick={togglePlay}>{playing ? '⏸ Pausar' : '▶ Reproducir'}</button>
            <button onClick={() => goTo(1)} aria-label="Volver al inicio">⏮</button>
            <div className="stepper">
              <button onClick={() => goTo(measure - 1)} aria-label="Compás anterior">‹</button>
              <label>Compás
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*" value={measure}
                  onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')); if (n > 0) goTo(n) }}
                  onFocus={e => e.target.select()}
                />
              </label>
              <span className="muted">/ {score.measures}</span>
              <button onClick={() => goTo(measure + 1)} aria-label="Compás siguiente">›</button>
            </div>
            <label>Velocidad
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
              </select>
            </label>
            <label>Nombres
              <select value={labels} onChange={e => setLabels(e.target.value as LabelMode)}>
                <option value="solfege">Do Re Mi</option>
                <option value="letters">C D E</option>
                <option value="none">Ninguno</option>
              </select>
            </label>
            <button className={`toggle${showNames ? ' on' : ''}`} onClick={() => setShowNames(v => !v)} aria-pressed={showNames}>{showNames ? '✓ Notas en partitura' : 'Notas en partitura'}</button>
            <button className={`toggle${sound ? ' on' : ''}`} onClick={() => setSound(v => !v)} aria-pressed={sound}>{sound ? '🔊 Sonido' : '🔇 Mudo'}</button>
          </section>

          <main className="stage">
            <ScoreView pdfData={pdfData} page={page} active={activeNotes} noteLabels={noteLabels} />
          </main>

          <footer className="keyboard">
            <PianoKeyboard active={active} labels={labels} names={keyNames} />
          </footer>
        </>
      )}
    </div>
  )
}
