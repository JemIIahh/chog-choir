import type { RefObject } from 'react'
import { thumbLg, type Chog } from '../data/chogs'

/** A Chog as an album: the artwork is the sleeve, and the record slides out and spins while it plays. */
export function RecordSleeve({ chog, playing, faceRef, size }: { chog: Chog; playing: boolean; faceRef?: RefObject<HTMLDivElement | null>; size?: number }) {
  return (
    <div className={`sleeve-wrap v${chog.spec.vowel} ${playing ? 'on' : ''}`} style={size ? ({ ['--s' as string]: `min(${size}px, calc((100vw - 60px) / 1.68))` } as React.CSSProperties) : undefined}>
      <div className="disc" aria-hidden>
        <div className="spinner">
          <div className="grooves" />
          <div className="sheen" />
          <div className="label"><img src={thumbLg(chog.n)} alt="" draggable={false} /></div>
          <div className="spindle" />
        </div>
      </div>
      <div className="sleeve" ref={faceRef}>
        <img src={thumbLg(chog.n)} alt={`Chog #${chog.n}`} draggable={false} />
      </div>
    </div>
  )
}
