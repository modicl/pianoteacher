import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'

// El lector de PDF corre dentro del paquete principal, sin Web Worker separado. Así pasa por la misma
// traducción de sintaxis y los mismos polyfills que el resto de la app (un iPad con iPadOS viejo no entiende
// el archivo del worker tal cual viene, y ahí fallaba con "Unexpected token '.'").
// Con este manejador presente, pdf.js lo usa en el hilo principal en vez de crear un Worker.
;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker
