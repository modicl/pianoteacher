// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest'
import { observeWidth } from '../src/ui/observe-width'

afterEach(() => { vi.unstubAllGlobals() })

function box(width: number) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true })
  return el
}

test('con ResizeObserver: avisa el ancho inicial y los cambios', () => {
  let callback: () => void = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { callback = cb } observe() {} disconnect() { disconnect() } })
  const el = box(800)
  const seen: number[] = []
  const stop = observeWidth(el, w => seen.push(w))
  expect(seen).toEqual([800])
  Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true })
  callback()
  expect(seen).toEqual([800, 1000])
  stop()
  expect(disconnect).toHaveBeenCalled()
})

test('Safari antiguo sin ResizeObserver: usa resize y orientationchange de la ventana', () => {
  vi.stubGlobal('ResizeObserver', undefined)
  const el = box(700)
  const seen: number[] = []
  const stop = observeWidth(el, w => seen.push(w))
  expect(seen).toEqual([700])
  Object.defineProperty(el, 'clientWidth', { value: 900, configurable: true })
  window.dispatchEvent(new Event('resize'))
  expect(seen).toEqual([700, 900])
  Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true })
  window.dispatchEvent(new Event('orientationchange'))
  expect(seen).toEqual([700, 900, 600])
  stop()
  window.dispatchEvent(new Event('resize'))
  expect(seen).toHaveLength(3)
})
