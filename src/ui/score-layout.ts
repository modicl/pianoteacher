const MIN_SCALE = 0.5
const MAX_SCALE = 2.4

/** Escala para que la página llene el ancho del contenedor (se lee mejor que ver la página entera pequeña). */
export function fitScale(containerWidth: number, pageWidth: number): number {
  if (!(containerWidth > 0) || !(pageWidth > 0)) return MIN_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, containerWidth / pageWidth))
}

/**
 * Posición de scroll para que las notas activas queden a ~40% de la altura visible.
 * `ys` son alturas en puntos de la página; se apunta a la más alta (la del pentagrama superior de la mano derecha).
 */
export function scrollTargetFor(ys: number[], scale: number, viewportHeight: number, contentHeight: number): number | null {
  if (!ys.length) return null
  const top = Math.min(...ys) * scale
  const target = top - viewportHeight * 0.4
  return Math.max(0, Math.min(target, Math.max(0, contentHeight - viewportHeight)))
}
