import { useMemo } from 'react'
import { noteName } from '../score-parser/pitch'
import { buildKeys, whiteKeyCount } from './piano-layout'
import './PianoKeyboard.css'

export type LabelMode = 'letters' | 'solfege' | 'none'

interface Props {
  /** nota MIDI → mano que la toca */
  active: Map<number, 'R' | 'L'>
  labels: LabelMode
  /** nombre escrito de cada nota que suena (Sol♭ en vez de Fa♯); sin él se usa la escritura con sostenidos */
  names?: Map<number, string>
}

export function PianoKeyboard({ active, labels, names }: Props) {
  const keys = useMemo(() => buildKeys(), [])
  const whites = whiteKeyCount(keys)
  const whiteWidth = 100 / whites

  return (
    <div className="piano" role="img" aria-label="Teclado de piano">
      {keys.map(k => {
        const hand = active.get(k.midi)
        const left = k.black ? (k.index + 1) * whiteWidth - whiteWidth * 0.3 : k.index * whiteWidth
        const width = k.black ? whiteWidth * 0.6 : whiteWidth
        const showLabel = labels !== 'none' && (hand || (!k.black && k.midi % 12 === 0))
        return (
          <div
            key={k.midi}
            className={`key ${k.black ? 'black' : 'white'}${hand ? ` on ${hand === 'R' ? 'right' : 'left'}` : ''}`}
            style={{ left: `${left}%`, width: `${width}%` }}
          >
            {showLabel && <span>{names?.get(k.midi) ?? noteName(k.midi, labels === 'letters' ? 'letters' : 'solfege')}</span>}
          </div>
        )
      })}
    </div>
  )
}
