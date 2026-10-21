import type { Chog } from '../data/chogs'
import { thumb } from '../data/chogs'

type Props = {
  band: { chog: Chog; count: number }[]
  brushId: number | null
  onPick(c: Chog): void
}

/** Who is on the staff right now. Click one to make it the brush. */
export function BandTray({ band, brushId, onPick }: Props) {
  if (band.length === 0)
    return <p className="band-empty">The staff is empty. Pick a Chog from the shelf, then tap the staff to place its note.</p>
  return (
    <div className="band" role="group" aria-label="Chogs on the staff">
      {band.map(({ chog, count }) => (
        <button key={chog.id} className={`member v${chog.spec.vowel} ${brushId === chog.id ? 'sel' : ''}`} onClick={() => onPick(chog)} title={`Chog #${chog.n}: ${count} ${count === 1 ? 'note' : 'notes'}`}>
          <img src={thumb(chog.n)} alt="" draggable={false} />
          <span className="m-n">#{chog.n}</span>
          <span className="m-c">{count}</span>
        </button>
      ))}
    </div>
  )
}
