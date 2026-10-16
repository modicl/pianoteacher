import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Glyph, PageData, Segment, Shape } from './types'

type Matrix = [number, number, number, number, number, number]

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: Matrix, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

function open(data: Uint8Array) {
  // pdf.js transfiere el buffer; se entrega una copia para poder reutilizar `data`
  return getDocument({ data: data.slice(), useSystemFonts: false, verbosity: 0, fontExtraProperties: true })
}

export async function pageCount(data: Uint8Array): Promise<number> {
  const task = open(data)
  try { return (await task.promise).numPages } finally { void task.destroy() }
}

export async function extractPage(data: Uint8Array, pageIndex: number): Promise<PageData> {
  const task = open(data)
  try { return await readPage(await task.promise, pageIndex) } finally { void task.destroy() }
}

async function readPage(doc: PDFDocumentProxy, pageIndex: number): Promise<PageData> {
  const page = await doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const height = viewport.height

  const glyphs: Glyph[] = []
  const ops = await page.getOperatorList()

  const fontNames = new Map<string, string>()
  const fontOf = (id: string) => {
    if (!fontNames.has(id)) {
      let name = id
      try { name = page.commonObjs.get(id).name ?? id } catch { /* fuente aún no resuelta */ }
      fontNames.set(id, name)
    }
    return fontNames.get(id)!
  }

  const segments: Segment[] = []
  const shapes: Shape[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const stack: { ctm: Matrix; lineWidth: number }[] = []
  let lineWidth = 1
  let leading = 0
  /** de coordenadas del PDF a coordenadas de página (y hacia abajo), respetando MediaBox y rotación */
  const flip = (p: [number, number]): [number, number] => viewport.convertToViewportPoint(p[0], p[1]) as [number, number]
  let tm: Matrix = [1, 0, 0, 1, 0, 0]
  let font = ''
  let fontSize = 1
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i]
    if (fn === OPS.save) stack.push({ ctm, lineWidth })
    else if (fn === OPS.restore) { const top = stack.pop(); if (top) { ctm = top.ctm; lineWidth = top.lineWidth } }
    else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix)
    else if (fn === OPS.setLineWidth) lineWidth = args[0]
    else if (fn === OPS.beginText) tm = [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.setFont) { font = fontOf(args[0]); fontSize = args[1] }
    else if (fn === OPS.setTextMatrix) tm = Array.from(args[0] as ArrayLike<number>) as Matrix
    else if (fn === OPS.moveText) tm = mul(tm, [1, 0, 0, 1, args[0], args[1]])
    else if (fn === OPS.setLeading) leading = args[0]
    else if (fn === OPS.setLeadingMoveText) { leading = -args[1]; tm = mul(tm, [1, 0, 0, 1, args[0], args[1]]) }
    else if (fn === OPS.nextLine) tm = mul(tm, [1, 0, 0, 1, 0, -leading])
    else if (fn === OPS.showText) {
      for (const el of args[0] as (number | { unicode?: string; width: number })[]) {
        if (typeof el === 'number') {
          tm = mul(tm, [1, 0, 0, 1, (-el / 1000) * fontSize, 0])
        } else {
          const [x, y] = apply(ctm, tm[4], tm[5])
          const size = fontSize * Math.hypot(tm[0], tm[1]) * Math.hypot(ctm[0], ctm[1])
          if (el.unicode && el.unicode !== ' ') { const [px, py] = flip([x, y]); glyphs.push({ char: el.unicode, font, x: px, y: py, size }) }
          tm = mul(tm, [1, 0, 0, 1, (el.width / 1000) * fontSize, 0])
        }
      }
    }
    else if (fn === OPS.constructPath) {
      const op = args[0] as number
      const stroke = op === OPS.stroke || op === OPS.closeStroke
      const fill = op === OPS.fill || op === OPS.eoFill || op === OPS.fillStroke || op === OPS.eoFillStroke
      const scale = Math.hypot(ctm[0], ctm[1])
      for (const path of args[1] as number[][]) {
        let k = 0
        let cur: [number, number] | null = null
        let start: [number, number] | null = null
        let pts: [number, number][] = []
        let curves = false
        const flush = () => {
          if (fill && pts.length >= 3) shapes.push(makeShape(pts, curves))
          pts = []; curves = false
        }
        const line = (a: [number, number], b: [number, number]) =>
          { const fa = flip(a), fb = flip(b); segments.push({ x1: fa[0], y1: fa[1], x2: fb[0], y2: fb[1], width: stroke ? lineWidth * scale : 0 }) }
        while (k < path.length) {
          const cmd = path[k++]
          if (cmd === 0) { flush(); const p = apply(ctm, path[k++], path[k++]); cur = p; start = p; pts.push(flip(p)) }
          else if (cmd === 1) {
            const p = apply(ctm, path[k++], path[k++])
            if (cur) line(cur, p)
            cur = p; pts.push(flip(p))
          } else if (cmd === 2) {
            k += 4; const p = apply(ctm, path[k++], path[k++]); cur = p; curves = true; pts.push(flip(p))
          } else if (cmd === 3) {
            k += 2; const p = apply(ctm, path[k++], path[k++]); cur = p; curves = true; pts.push(flip(p))
          } else if (cmd === 4) {
            if (cur && start) line(cur, start)
            cur = start
          } else break
        }
        flush()
      }
    }
  })

  return { index: pageIndex, width: viewport.width, height, glyphs, segments, shapes }
}

function makeShape(pts: [number, number][], curves: boolean): Shape {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  return { pts, curves, x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) }
}
