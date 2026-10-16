/** Carga perezosa de pdf.js y del lector de partituras (son lo más pesado de la app). */
export async function loadPdfjs() {
  await import('./pdf-setup')
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}

export async function loadParser() {
  await import('./pdf-setup')
  return import('./score-parser')
}
