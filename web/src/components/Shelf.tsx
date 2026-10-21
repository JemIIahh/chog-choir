import { memo, useMemo, useState } from 'react'
import { VOWELS, type VoiceType } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { thumb } from '../data/chogs'

type Props = {
  chogs: Chog[]
  selectedId: number | null
  onSelect(c: Chog): void
  /** Chogs the connected wallet really holds, shown first when present */
  mine?: Set<number> | null
}

const TYPES: VoiceType[] = ['bass', 'tenor', 'alto', 'soprano']
const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const PAGE = 120

function Chip({ on, onClick, children, dot }: { on: boolean; onClick(): void; children: React.ReactNode; dot?: string }) {
  return (
    <button className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {dot && <i className={`dot ${dot}`} />}
      {children}
    </button>
  )
}

export const Shelf = memo(function Shelf({ chogs, selectedId, onSelect, mine }: Props) {
  const [q, setQ] = useState('')
  const [vowel, setVowel] = useState<number | null>(null)
  const [type, setType] = useState<VoiceType | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const list = useMemo(() => {
    const term = q.trim().replace('#', '')
    return chogs.filter(c => {
      if (onlyMine && mine && !mine.has(c.id)) return false
      if (vowel !== null && c.spec.vowel !== vowel) return false
      if (type && c.spec.voiceType !== type) return false
      if (tier && c.traits.Tier !== tier) return false
      if (term && !String(c.n).startsWith(term) && !Object.values(c.traits).some(v => v.toLowerCase().includes(term.toLowerCase()))) return false
      return true
    })
  }, [chogs, q, vowel, type, tier, onlyMine, mine])

  const reset = () => setShown(PAGE)

  return (
    <section className="shelf" aria-label="Chogs">
      <div className="shelf-head">
        <h2>Pick a Chog</h2>
        <span className="count">{list.length.toLocaleString()} of {chogs.length.toLocaleString()}</span>
      </div>
      <input
        className="search"
        placeholder="Search a number or a trait, like 1462 or Wizard"
        value={q}
        onChange={e => { setQ(e.target.value); reset() }}
        aria-label="Search Chogs"
      />
      <div className="chips" role="group" aria-label="Vowel">
        {VOWELS.map((v, i) => (
          <Chip key={v} on={vowel === i} dot={`v${i}`} onClick={() => { setVowel(vowel === i ? null : i); reset() }}>{v.toLowerCase()}</Chip>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Voice">
        {TYPES.map(t => (
          <Chip key={t} on={type === t} onClick={() => { setType(type === t ? null : t); reset() }}>{t}</Chip>
        ))}
        {mine && mine.size > 0 && (
          <Chip on={onlyMine} onClick={() => { setOnlyMine(!onlyMine); reset() }}>mine ({mine.size})</Chip>
        )}
      </div>
      <div className="chips" role="group" aria-label="Tier">
        {TIERS.map(t => (
          <Chip key={t} on={tier === t} onClick={() => { setTier(tier === t ? null : t); reset() }}>{t.toLowerCase()}</Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="empty">No Chog matches. Clear a filter or search a different trait.</p>
      ) : (
        <div className="thumbs">
          {list.slice(0, shown).map(c => (
            <button
              key={c.id}
              className={`thumb v${c.spec.vowel} ${selectedId === c.id ? 'sel' : ''} ${mine?.has(c.id) ? 'mine' : ''}`}
              onClick={() => onSelect(c)}
              aria-label={`Chog #${c.n}, sings ${VOWELS[c.spec.vowel].toLowerCase()}`}
              title={`#${c.n} · ${c.spec.voiceType} · ${VOWELS[c.spec.vowel].toLowerCase()}`}
            >
              <img src={thumb(c.n)} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
      {list.length > shown && (
        <button className="more" onClick={() => setShown(shown + PAGE * 2)}>Show more</button>
      )}
    </section>
  )
})
