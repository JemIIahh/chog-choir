import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react'
import { VOWELS } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { thumb } from '../data/chogs'
import { MODES, PITCHES, STEPS, midiFor } from '../lib/music'
import type { Note, Song } from '../lib/share'

export type StaffHandle = {
  /** The step lands in `delay` ms: move the playhead, make the Chogs on it sing. */
  hit(step: number, delay: number): void
  rest(): void
}

type Props = {
  song: Song
  byId: Map<number, Chog>
  brush: Chog | null
  onPlace(step: number, pitch: number): void
  onRemove(note: Note): void
  /** extra notes drawn but not editable, e.g. the on-chain loop */
  readOnly?: boolean
  /** a note that is being previewed before it is sent */
  pending?: { step: number; pitch: number; chog: Chog } | null
}

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const noteName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
const SOUNDS = ['ahh', 'ehh', 'eee', 'ohh', 'ooo']
const RING = ['#ff5a47', '#ffb020', '#25cf94', '#2db4f2', '#9b6bff']
const tilt = (id: number) => `${((id * 37) % 9) - 4}deg` // a few degrees either way, like stickers pressed on by hand

export const Staff = memo(
  forwardRef<StaffHandle, Props>(function Staff({ song, byId, brush, onPlace, onRemove, readOnly, pending }, ref) {
    const rootRef = useRef<HTMLDivElement>(null)
    const colRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      hit(step, delay) {
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.setTimeout(() => {
          const root = rootRef.current
          const col = colRef.current
          if (!root || !col) return
          col.style.opacity = '1'
          col.style.transform = `translateX(${step * 100}%)`
          let shown = 0
          root.querySelectorAll<HTMLElement>(`.note[data-step="${step}"]`).forEach(el => {
            if (calm) return // the highlighted column already shows who is singing
            // each note leaves a stain on the paper in its vowel's colour, which fades like wet ink
            const slot = el.parentElement
            if (slot) {
              const hex = RING[Number(el.dataset.vowel)]
              const stain = document.createElement('i')
              stain.className = 'stain'
              stain.style.background = `radial-gradient(circle, ${hex}d0 0%, ${hex}00 68%)`
              slot.insertBefore(stain, slot.firstChild)
              stain.animate([{ transform: 'scale(.45)', opacity: 0.7 }, { transform: 'scale(2.3)', opacity: 0 }], { duration: 2800, easing: 'ease-out', fill: 'forwards' }).onfinish = () => stain.remove()
            }
            el.animate(
              [{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-5deg)', offset: 0.28 }, { transform: 'scale(1)' }],
              { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' },
            )
            if (shown++ < 4) {
              const b = document.createElement('span')
              b.className = `bubble v${el.dataset.vowel}`
              b.textContent = SOUNDS[Number(el.dataset.vowel)]
              el.parentElement?.appendChild(b)
              b.animate(
                [{ transform: 'translate(-50%, 0) scale(.7)', opacity: 0 }, { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -34px) scale(1)', opacity: 0 }],
                { duration: 760, easing: 'ease-out', fill: 'forwards' },
              ).onfinish = () => b.remove()
            }
          })
        }, delay)
      },
      rest() {
        if (colRef.current) colRef.current.style.opacity = '0'
      },
    }))

    const { noteAt, stacked } = useMemo(() => {
      const m = new Map<number, Note>()
      const c = new Map<number, number>()
      for (const n of song.notes) {
        const k = n.step * PITCHES + n.pitch
        m.set(k, n)
        c.set(k, (c.get(k) ?? 0) + 1)
      }
      return { noteAt: m, stacked: c }
    }, [song.notes])

    const rootRows = MODES[song.mode].intervals.length
    const rows = Array.from({ length: PITCHES }, (_, i) => PITCHES - 1 - i)

    return (
      <div className="staff" ref={rootRef} style={brush ? ({ ['--ghost' as string]: `url(${thumb(brush.n)})` } as React.CSSProperties) : undefined}>
        <div className="gutter" aria-hidden>
          {rows.map(p => (
            <span key={p} className={p % rootRows === 0 ? 'gl root' : 'gl'}>
              {p % rootRows === 0 ? noteName(midiFor(p, song.root, song.mode)) : ''}
            </span>
          ))}
        </div>
        <div className="grid" role="grid" aria-label="Staff: 16 steps by 12 pitches">
          <div className="playhead" ref={colRef} aria-hidden />
          {rows.map(p =>
            Array.from({ length: STEPS }, (_, s) => {
              const note = noteAt.get(s * PITCHES + p)
              const chog = note ? byId.get(note.id) : undefined
              const pend = pending && pending.step === s && pending.pitch === p ? pending.chog : null
              const cls = ['cell', p % rootRows === 0 ? 'rootrow' : '', s % 4 === 0 ? 'beat' : '', note ? 'has' : ''].join(' ')
              return (
                <button
                  key={`${s}-${p}`}
                  className={cls}
                  disabled={readOnly}
                  onClick={() => (note ? onRemove(note) : onPlace(s, p))}
                  aria-label={note && chog ? `Chog #${chog.n}, step ${s + 1}, remove` : `Step ${s + 1}, row ${p + 1}, ${brush ? `place Chog #${brush.n}` : 'empty'}`}
                >
                  {note && chog ? (
                    <span className="slot" style={{ ['--tilt' as string]: tilt(chog.id) } as React.CSSProperties}>
                      <img className={`note v${chog.spec.vowel}`} data-step={s} data-vowel={chog.spec.vowel} src={thumb(chog.n)} alt="" draggable={false} />
                      {(stacked.get(s * PITCHES + p) ?? 1) > 1 && <span className="stack" title="More Chogs sing this same note">+{(stacked.get(s * PITCHES + p) ?? 1) - 1}</span>}
                    </span>
                  ) : pend ? (
                    <span className="slot">
                      <img className={`note pending v${pend.spec.vowel}`} src={thumb(pend.n)} alt="" draggable={false} />
                    </span>
                  ) : (
                    !readOnly && <span className="ghost" />
                  )}
                </button>
              )
            }),
          )}
        </div>
      </div>
    )
  }),
)

export const vowelName = (v: number) => VOWELS[v]
