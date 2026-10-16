/** Índice del compás (en el orden de reproducción) que contiene un pulso; `starts` está ordenado. */
export function occurrenceAt(starts: number[], beat: number): number {
  let lo = 0
  let hi = starts.length - 1
  let found = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= beat + 1e-9) { found = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return found
}
