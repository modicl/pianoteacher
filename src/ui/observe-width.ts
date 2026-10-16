/**
 * Avisa el ancho de un elemento ahora y cada vez que cambia. Devuelve la función para dejar de observar.
 * Safari anterior a 13.1 no tiene ResizeObserver: se usan los eventos de la ventana (cambio de tamaño y giro del iPad).
 */
export function observeWidth(el: HTMLElement, onWidth: (width: number) => void): () => void {
  const update = () => onWidth(el.clientWidth)
  update()
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
  return () => {
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
  }
}
