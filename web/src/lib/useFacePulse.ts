import { useEffect, type RefObject } from 'react'
import type { Player } from '../audio/usePlayer'
import type { Chog } from '../data/chogs'
import type { Song } from './share'

const SOUND = ['ahh', 'ehh', 'eee', 'ohh', 'ooo']

/** The face keeps time: a small pulse on every beat, a bigger one with a vowel bubble when it sings. */
export function useFacePulse(player: Player, song: Song, chog: Chog, faceRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => player.onStep(({ step, delay }) => {
    window.setTimeout(() => {
      const el = faceRef.current
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const sings = song.notes.some(x => x.step === step)
      el.animate([{ transform: 'scale(1)' }, { transform: `scale(${sings ? 1.09 : 1.025})` }, { transform: 'scale(1)' }], { duration: sings ? 380 : 240, easing: 'ease-out' })
      if (sings) {
        const b = document.createElement('span')
        b.className = `bubble v${chog.spec.vowel} big`
        b.textContent = SOUND[chog.spec.vowel]
        el.appendChild(b)
        b.animate([{ transform: 'translate(-50%, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -34px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }).onfinish = () => b.remove()
      }
    }, delay)
  }), [player, song, chog, faceRef])
}
