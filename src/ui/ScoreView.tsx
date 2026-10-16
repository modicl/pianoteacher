import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Note } from '../score-parser'
import { fitScale, scrollTargetFor } from './score-layout'
import { observeWidth } from './observe-width'
import type { NoteLabel } from './note-labels'
import './ScoreView.css'

interface Props {
  pdfData: Uint8Array
  page: number
  active: Note[]
  /** nombres de las notas para dibujar sobre la partitura (vacío = ocultos) */
  noteLabels?: NoteLabel[]
}

/** Página del PDF ajustada al ancho de la pantalla; se desplaza sola para seguir las notas activas. */
export function ScoreView({ pdfData, page, active, noteLabels = [] }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [baseWidth, setBaseWidth] = useState(595)
  const [boxWidth, setBoxWidth] = useState(0)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const scale = fitScale(boxWidth - 24, baseWidth)

  useEffect(() => {
    let cancelled = false
    let task: { destroy: () => Promise<void> } | null = null
    ;(async () => {
      const { loadPdfjs } = await import('../pdf-loader')
      const { getDocument } = await loadPdfjs()
      if (cancelled) return
      const loading = getDocument({ data: pdfData.slice() })
      task = loading
      const d = await loading.promise
      if (!cancelled) setDoc(d)
    })().catch(() => { /* carga cancelada al desmontar */ })
    return () => { cancelled = true; void task?.destroy().catch(() => {}) }
  }, [pdfData])

  // ancho disponible (cambia al girar el iPad)
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    return observeWidth(el, setBoxWidth)
  }, [])

  useEffect(() => {
    if (!doc || boxWidth <= 0) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    ;(async () => {
      const p = await doc.getPage(page + 1)
      const base = p.getViewport({ scale: 1 })
      if (cancelled) return
      setBaseWidth(base.width)
      const viewport = p.getViewport({ scale: fitScale(boxWidth - 24, base.width) })
      const canvas = canvasRef.current
      if (!canvas) return
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const context = canvas.getContext('2d')!
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      setSize({ width: viewport.width, height: viewport.height })
      const render = p.render({ canvasContext: context, canvas, viewport })
      task = render
      await render.promise
    })().catch(() => { /* render cancelado */ })
    return () => { cancelled = true; task?.cancel() }
  }, [doc, page, boxWidth])

  // al cambiar de página se vuelve arriba
  useEffect(() => { scrollerRef.current?.scrollTo({ top: 0 }) }, [page])

  const here = useMemo(() => active.filter(n => n.page === page), [active, page])

  // seguir la nota: solo se mueve cuando sale de la zona cómoda, para no marear
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !here.length || !size.height) return
    const ys = here.map(n => n.y)
    const noteTop = Math.min(...ys) * scale
    const comfortable = noteTop > el.scrollTop + el.clientHeight * 0.15 && noteTop < el.scrollTop + el.clientHeight * 0.65
    if (comfortable) return
    const target = scrollTargetFor(ys, scale, el.clientHeight, size.height)
    if (target === null) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: target, behavior: calm ? 'auto' : 'smooth' })
  }, [here, scale, size.height])

  return (
    <div className="score-scroller" ref={scrollerRef}>
      <div
        className="score-view"
        style={{ width: size.width || undefined, height: size.height || undefined, ['--s' as string]: scale / 1.5, ['--scale' as string]: scale }}
      >
        <canvas ref={canvasRef} />
        {noteLabels.map((l, i) => (
          <span
            key={`${l.hand}-${l.x}-${l.y}-${i}`}
            className={`note-label ${l.hand === 'R' ? 'right' : 'left'}`}
            style={{ left: l.x * scale, top: (l.hand === 'R' ? l.y - 9 : l.y + 9) * scale }}
          >
            {l.text}
          </span>
        ))}
        {here.map((n, i) => (
          <span
            key={`${n.midi}-${n.startBeat}-${n.hand}-${i}`}
            className={`marker ${n.hand === 'R' ? 'right' : 'left'}`}
            style={{ left: n.x * scale, top: n.y * scale }}
          />
        ))}
      </div>
    </div>
  )
}
