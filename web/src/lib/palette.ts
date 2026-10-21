import { currentTheme, type Theme } from './theme'

// Colours for everything drawn on a canvas (posters, clips), so exports match the mode the app is in.
export type Pal = {
  mode: Theme
  /** how paint lands: dark mode lights the page (screen), light mode inks it (multiply) */
  paint: GlobalCompositeOperation
  field: string // the print area, and the staff paper
  card: string // the staff clip's card
  ink: string
  soft: string
  rule: string // staff lines
  ruleSoft: string
  sticker: string // the edge round every face
  shadow: string
  dotsA: string // halftone corners
  dotsB: string
  grooves: string
  tune: string // the line through the notes
  frame: string
  playhead: string
  /** the inks printed behind a title, nearest last */
  title: { dx: number; dy: number; c: string }[]
  ghost: number // alpha of the giant vowel
  bloom: number // strength of each note's colour bloom
  disc: string
  discRim: string
  dotOff: string // loop dots that do not sing
  grain: { amount: number; op: GlobalCompositeOperation }
}

const DARK: Pal = {
  mode: 'dark',
  paint: 'screen',
  field: '#1a1512',
  card: '#211b18',
  ink: '#f4ece0',
  soft: '#a89b8b',
  rule: 'rgba(244,236,224,.2)',
  ruleSoft: 'rgba(244,236,224,.12)',
  sticker: '#15110f',
  shadow: 'rgba(0,0,0,.55)',
  dotsA: 'rgba(255,176,46,.5)',
  dotsB: 'rgba(255,107,87,.45)',
  grooves: 'rgba(244,236,224,.07)',
  tune: 'rgba(244,236,224,.8)',
  frame: 'rgba(244,236,224,.55)',
  playhead: 'rgba(255,227,179,.2)',
  title: [{ dx: -5, dy: 0, c: 'rgba(53,182,240,.9)' }, { dx: 5, dy: 0, c: 'rgba(255,107,87,.9)' }],
  ghost: 0.22,
  bloom: 1,
  disc: '#0b0908',
  discRim: 'rgba(244,236,224,.5)',
  dotOff: 'rgba(244,236,224,.16)',
  grain: { amount: 0.22, op: 'overlay' },
}

const LIGHT: Pal = {
  mode: 'light',
  paint: 'multiply',
  field: '#ffffff',
  card: '#ffffff',
  ink: '#1c1a26',
  soft: '#6c6879',
  rule: 'rgba(28,26,38,.16)',
  ruleSoft: 'rgba(28,26,38,.1)',
  sticker: '#ffffff',
  shadow: 'rgba(28,26,38,.28)',
  dotsA: 'rgba(255,107,87,.45)',
  dotsB: 'rgba(53,182,240,.5)',
  grooves: 'rgba(28,26,38,.06)',
  tune: 'rgba(28,26,38,.78)',
  frame: '#1c1a26',
  playhead: 'rgba(255,194,77,.45)',
  title: [{ dx: 9, dy: 9, c: 'rgba(28,26,38,.1)' }, { dx: 5, dy: 5, c: 'rgba(124,92,255,.3)' }],
  ghost: 0.28,
  bloom: 0.6, // ink multiplies, so overlapping blooms need a lighter hand to stay clean
  disc: '#151218',
  discRim: '#1c1a26',
  dotOff: 'rgba(28,26,38,.14)',
  grain: { amount: 0.3, op: 'soft-light' },
}

export const palette = (mode: Theme = currentTheme()): Pal => (mode === 'light' ? LIGHT : DARK)

/** The page the artwork sits on. Dark: a warm room with one spot from above. Light: white washed with pale vowel colours. */
export function paintBackground(g: CanvasRenderingContext2D, w: number, h: number, pal: Pal) {
  if (pal.mode === 'dark') {
    const spot = g.createRadialGradient(w / 2, -h * 0.06, 40, w / 2, h * 0.22, h * 0.95)
    spot.addColorStop(0, '#3b2e25'); spot.addColorStop(0.5, '#1f1916'); spot.addColorStop(1, '#15110f')
    g.fillStyle = spot
    g.fillRect(0, 0, w, h)
    for (const [x, y, c] of [[0.04, 1.02, '255,107,87,.14'], [0.98, 1.0, '164,123,255,.12']] as const) {
      const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, h * 0.55)
      gr.addColorStop(0, `rgba(${c})`); gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    }
    return
  }
  g.fillStyle = '#fdfbf8'
  g.fillRect(0, 0, w, h)
  for (const [x, y, r, c] of [
    [0.06, 0.04, 0.75, '255,160,140,.42'],
    [0.96, 0.06, 0.7, '255,214,130,.46'],
    [0.92, 0.96, 0.75, '140,225,195,.46'],
    [0.04, 0.96, 0.7, '150,205,245,.46'],
    [0.5, 0.5, 0.5, '190,165,255,.16'],
  ] as const) {
    const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h))
    gr.addColorStop(0, `rgba(${c})`); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
  }
}
