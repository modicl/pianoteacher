import { expect, test } from 'vitest'
import { activeNotes, beatToSeconds, Transport } from '../src/playback/clock'
import type { Note } from '../src/score-parser'

const n = (midi: number, s: number, d: number): Note =>
  ({ midi, startBeat: s, durationBeats: d, hand: 'R', page: 0, x: 0, y: 0, measure: 1 })

test('activeNotes respeta el intervalo semiabierto', () => {
  const notes = [n(60, 0, 1), n(62, 1, 1)]
  expect(activeNotes(notes, 0.5).map(x => x.midi)).toEqual([60])
  expect(activeNotes(notes, 1).map(x => x.midi)).toEqual([62])
})

test('Transport dispara noteOn/noteOff una vez por nota', () => {
  const t = new Transport([n(60, 0, 1)], 60)
  const on: number[] = [], off: number[] = []
  t.onNoteOn = x => on.push(x.midi)
  t.onNoteOff = x => off.push(x.midi)
  t.play(); t.tick(0.5); t.tick(0.6); t.tick(0.1)
  expect(on).toEqual([60])
  expect(off).toEqual([60])
})

test('la velocidad 0.5 duplica la duración real', () => {
  expect(beatToSeconds(1, 60, 0.5)).toBe(2)
})

test('Transport avanza con la velocidad y se detiene al terminar', () => {
  const t = new Transport([n(60, 0, 1)], 60)
  t.speed = 2
  t.play(); t.tick(0.25)
  expect(t.position).toBeCloseTo(0.5)
  t.tick(5)
  expect(t.playing).toBe(false)
})

test('seekMeasure apaga las notas activas y salta de compás', () => {
  const t = new Transport([n(60, 0, 8), n(62, 4, 1)], 60)
  const off: number[] = []
  t.onNoteOff = x => off.push(x.midi)
  t.play(); t.tick(0.5)
  t.seekMeasure(2, 4)
  expect(off).toEqual([60])
  expect(t.position).toBe(4)
})

test('acordes: todas las notas simultáneas están activas a la vez', () => {
  const chord = [n(60, 0, 1), n(64, 0, 1), n(67, 0, 1)]
  expect(activeNotes(chord, 0.5)).toHaveLength(3)
})

test('lista vacía no rompe el reloj', () => {
  const t = new Transport([], 60)
  t.play(); t.tick(1)
  expect(t.playing).toBe(false)
})

test('seek en pausa no hace sonar notas (sin noteOn)', () => {
  const t = new Transport([n(60, 0, 4)], 60)
  const on: number[] = []
  t.onNoteOn = x => on.push(x.midi)
  t.seek(1)
  expect(on).toEqual([])
  t.play(); t.tick(0.01)
  expect(on).toEqual([60])
})
