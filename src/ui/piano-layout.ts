export interface Key {
  midi: number
  black: boolean
  /** Para una blanca: su posición entre las blancas. Para una negra: la de la blanca que tiene a su izquierda. */
  index: number
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

export function buildKeys(lowMidi = 21, highMidi = 108): Key[] {
  const keys: Key[] = []
  let whites = 0
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    const black = BLACK_PITCH_CLASSES.has(midi % 12)
    if (black) keys.push({ midi, black, index: Math.max(0, whites - 1) })
    else keys.push({ midi, black, index: whites++ })
  }
  return keys
}

export function whiteKeyCount(keys: Key[]): number {
  return keys.filter(k => !k.black).length
}
