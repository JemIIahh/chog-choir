import { VOWELS } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { thumbLg } from '../data/chogs'

type Props = {
  chog: Chog | null
  noteCount: number
  onHear(): void
  onAddPhrase(): void
  onRemoveAll(): void
}

export function VoiceCard({ chog, noteCount, onHear, onAddPhrase, onRemoveAll }: Props) {
  if (!chog)
    return (
      <section className="voicecard empty-card">
        <p>Pick a Chog to hear it. Its traits decide how it sounds.</p>
      </section>
    )
  const vowel = VOWELS[chog.spec.vowel]
  return (
    <section className="voicecard" aria-live="polite">
      <div className="vc-top">
        <img className={`vc-face v${chog.spec.vowel}`} src={thumbLg(chog.n)} alt={`Chog #${chog.n}`} />
        <div className="vc-id">
          <h2>Chog #{chog.n}</h2>
          <p className="vc-type">{chog.spec.voiceType}{chog.traits.Tier && chog.traits.Tier !== 'Common' ? ` · ${chog.traits.Tier.toLowerCase()}` : ''}</p>
        </div>
        <div className={`vc-vowel v${chog.spec.vowel}`} aria-label={`Sings ${vowel.toLowerCase()}`}>{vowel.toLowerCase()}</div>
      </div>

      <ul className="why">
        {chog.why.map(w => (
          <li key={w.trait}>
            <span className="why-t">{w.value}<small>{w.trait}</small></span>
            <span className="why-e">{w.effect}</span>
          </li>
        ))}
      </ul>

      <div className="vc-actions">
        <button className="btn solid" onClick={onHear}>Hear it</button>
        <button className="btn" onClick={onAddPhrase}>Add its phrase</button>
        {noteCount > 0 && <button className="btn quiet" onClick={onRemoveAll}>Remove ({noteCount})</button>}
      </div>
    </section>
  )
}
