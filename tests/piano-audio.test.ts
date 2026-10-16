import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PianoAudio, midiToFrequency } from '../src/playback/piano-audio'

test('La4 = 440 Hz', () => {
  expect(midiToFrequency(69)).toBe(440)
})

test('Do central ≈ 261.63 Hz', () => {
  expect(midiToFrequency(60)).toBeCloseTo(261.63, 1)
})

// AudioContext falso: registra qué osciladores se detienen
const stops: number[] = []
let created = 0
let nextId = 0
class FakeParam {
  value = 1
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode { connect(n: unknown) { return n } }
class FakeGain extends FakeNode { gain = new FakeParam() }
class FakeOsc extends FakeNode {
  id = nextId++
  type = ''
  frequency = new FakeParam()
  start() {}
  stop() { stops.push(this.id) }
}
class FakeContext {
  state = 'running'
  currentTime = 0
  destination = new FakeNode()
  constructor() { created++ }
  resume() { return Promise.resolve() }
  createGain() { return new FakeGain() }
  createOscillator() { return new FakeOsc() }
}

beforeEach(() => { stops.length = 0; created = 0; nextId = 0; vi.stubGlobal('AudioContext', FakeContext) })
afterEach(() => { vi.unstubAllGlobals() })

test('dos notas iguales solapadas: soltar la corta no corta la larga', () => {
  const audio = new PianoAudio()
  const long = {}, short = {}
  audio.noteOn(long, 60)   // osciladores 0 y 1
  audio.noteOn(short, 60)  // osciladores 2 y 3
  audio.noteOff(short)
  expect(stops.sort()).toEqual([2, 3])
  audio.noteOff(long)
  expect(stops.sort()).toEqual([0, 1, 2, 3])
})

test('noteOff de una nota que nunca sonó no hace nada', () => {
  const audio = new PianoAudio()
  expect(() => audio.noteOff({})).not.toThrow()
})

test('unlock crea el contexto de audio al hacer clic, antes de la primera nota', () => {
  const audio = new PianoAudio()
  expect(created).toBe(0)
  audio.unlock()
  expect(created).toBe(1)
  audio.noteOn({}, 60)
  expect(created).toBe(1)
})

test('con el sonido apagado no se crea contexto ni voces', () => {
  const audio = new PianoAudio()
  audio.enabled = false
  audio.noteOn({}, 60)
  expect(created).toBe(0)
})

test('stopAll detiene todas las voces', () => {
  const audio = new PianoAudio()
  audio.noteOn({}, 60)
  audio.noteOn({}, 64)
  audio.stopAll()
  expect(stops).toHaveLength(4)
})

test('Safari antiguo: usa webkitAudioContext cuando AudioContext no existe', () => {
  vi.unstubAllGlobals()
  vi.stubGlobal('AudioContext', undefined)
  vi.stubGlobal('webkitAudioContext', FakeContext)
  const audio = new PianoAudio()
  audio.noteOn({}, 60)
  expect(created).toBe(1)
})

test('sin ninguna API de audio no se rompe (solo queda en silencio)', () => {
  vi.unstubAllGlobals()
  vi.stubGlobal('AudioContext', undefined)
  vi.stubGlobal('webkitAudioContext', undefined)
  const audio = new PianoAudio()
  expect(() => { audio.unlock(); audio.noteOn({}, 60); audio.noteOff({}); audio.stopAll() }).not.toThrow()
})
