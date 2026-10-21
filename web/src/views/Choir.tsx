import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'
import { VOWELS } from '../audio/voice'
import type { Player } from '../audio/usePlayer'
import { claimChog, explain, isClaimed, makeReader, placeNote, readHeld, readRound, readSung, type Reader, type Round } from '../chain/client'
import { monadMainnet, REAL_CHOG, resolveTarget, type Deployment, type Target } from '../chain/config'
import { useWallet } from '../chain/useWallet'
import { Dock } from '../components/Dock'
import { Staff } from '../components/Staff'
import { WalletPanel } from '../components/WalletPanel'
import { thumb, type Chog } from '../data/chogs'
import { epochKey, keyName } from '../lib/music'
import { type Song } from '../lib/share'
import { useToast } from '../lib/useToast'

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}

export function NotDeployed() {
  return (
    <main className="layout">
      <section className="stage">
        <h1>The Choir opens soon</h1>
        <p className="sub">The contract is not deployed on this build yet. The Studio works without it.</p>
      </section>
    </main>
  )
}

export function Choir(props: { chogs: Chog[]; byId: Map<number, Chog>; player: Player }) {
  const target = useMemo(resolveTarget, [])
  if (!target.deployment) return <NotDeployed />
  return <LiveChoir {...props} target={target} d={target.deployment} />
}

type Cell = { step: number; pitch: number }

function LiveChoir({ chogs, byId, player, target, d }: { chogs: Chog[]; byId: Map<number, Chog>; player: Player; target: Target; d: Deployment }) {
  const reader = useMemo<Reader>(() => makeReader(target), [target])
  const wallet = useWallet(target.chain)
  const { session } = wallet
  const { flash, node: toast } = useToast()

  const [round, setRound] = useState<Round | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now() / 1000)
  const offset = useRef(0)

  const [controls, setControls] = useState({ tempo: 84, space: 55, bright: 55 })
  const [held, setHeld] = useState<number[] | null>(null)
  const [realHeld, setRealHeld] = useState<number[]>([])
  const [sung, setSung] = useState<Set<number>>(new Set())
  const [brushId, setBrushId] = useState<number | null>(null)
  const [cell, setCell] = useState<Cell | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastTx, setLastTx] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false) // wallet has no gas on this network

  // ── the round, straight from the chain
  const refresh = useCallback(async () => {
    try {
      const r = await readRound(reader, d)
      offset.current = r.now - Date.now() / 1000
      setRound(r)
      setLoadErr(null)
    } catch (e) {
      setLoadErr(explain(e))
    }
  }, [reader, d])

  useEffect(() => {
    void refresh()
    const poll = window.setInterval(refresh, 6000)
    const tick = window.setInterval(() => setNow(Date.now() / 1000 + offset.current), 500)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [refresh])

  const remaining = round ? round.end - now : 0
  useEffect(() => { if (round && remaining <= -1) void refresh() }, [round, remaining, refresh])

  const key = useMemo(() => (round ? epochKey(round.epoch) : { root: 0, mode: 0 }), [round])
  const song: Song = useMemo(() => ({ ...controls, ...key, notes: round?.notes ?? [] }), [controls, key, round?.notes])
  useEffect(() => { player.bind(song) }, [song, player])

  // ── who this wallet can sing for
  const loadHeld = useCallback(async () => {
    if (!session) { setHeld(null); setRealHeld([]); return }
    try { setHeld(await readHeld(reader, d.nft, session.account)) } catch { setHeld([]) }
    // real holders on Monad mainnet are shown too, so they can bring their own Chogs over
    if (target.chain.id === 10143) {
      try { setRealHeld(await readHeld(makeReader({ chain: monadMainnet, deployment: null }), REAL_CHOG as Address, session.account)) } catch { setRealHeld([]) }
    }
  }, [session, reader, d.nft, target.chain.id])
  useEffect(() => { void loadHeld() }, [loadHeld])
  useEffect(() => {
    if (!session) { setEmpty(false); return }
    void reader.pub.getBalance({ address: session.account }).then(b => setEmpty(b === 0n)).catch(() => setEmpty(false))
  }, [session, reader, lastTx, held?.length])

  useEffect(() => {
    if (!round || !held) { setSung(new Set()); return }
    void readSung(reader, d, round.epoch, held).then(setSung).catch(() => setSung(new Set()))
  }, [round?.epoch, round?.notes.length, held, reader, d]) // eslint-disable-line react-hooks/exhaustive-deps

  const brush = brushId ? byId.get(brushId) ?? null : null
  const canSing = !!(session && brush && held?.includes(brush.id) && !sung.has(brush.id))

  const pick = useCallback((c: Chog) => {
    setBrushId(c.id)
    player.hear(c, Math.round((c.spec.low + c.spec.high) / 2))
  }, [player])

  const place = useCallback((step: number, pitch: number) => {
    if (!brush) { flash(session ? 'Pick one of your Chogs first.' : 'Connect a wallet to sing. You can still listen.'); return }
    setCell({ step, pitch })
    player.hear(brush, pitch)
  }, [brush, session, flash, player])

  const sing = useCallback(async () => {
    if (!session || !brush || !cell) return
    setBusy('Sending to your wallet…')
    try {
      const hash = await placeNote(reader, session, d, brush.id, cell.step, cell.pitch)
      setLastTx(hash)
      setCell(null)
      flash(`Chog #${brush.n} is in the choir.`)
      await refresh()
    } catch (e) {
      flash(explain(e))
    } finally {
      setBusy(null)
    }
  }, [session, brush, cell, reader, d, refresh, flash])

  const claim = useCallback(async (id: number) => {
    if (!session) return
    setBusy('Claiming…')
    try {
      if (await isClaimed(reader, d.nft, id)) { flash(`Chog #${byId.get(id)?.n ?? id} is already claimed on testnet.`); return }
      await claimChog(reader, session, d, id)
      await loadHeld()
      setBrushId(id)
      flash(`Claimed Chog #${byId.get(id)?.n ?? id}. It is yours on testnet.`)
    } catch (e) {
      flash(explain(e))
    } finally {
      setBusy(null)
    }
  }, [session, reader, d, byId, loadHeld, flash])

  const claimRandom = useCallback(async () => {
    if (!session) return
    setBusy('Finding a free Chog…')
    try {
      for (let i = 0; i < 12; i++) {
        const id = 1 + Math.floor(Math.random() * 1969)
        if (!(await isClaimed(reader, d.nft, id))) { setBusy(null); return void (await claim(id)) }
      }
      flash('Could not find a free Chog just now. Try again.')
    } finally {
      setBusy(null)
    }
  }, [session, reader, d.nft, claim, flash])

  const voices = round?.notes.length ?? 0
  const explorer = target.chain.blockExplorers?.default.url
  const mine = held ?? []
  const free = mine.filter(id => !sung.has(id))

  return (
    <>
      <main className="layout">
        <section className="stage" aria-label="The Choir">
          <div className="stage-head">
            <div>
              <h1>{round ? `Round ${round.epoch + 1}` : 'The Choir'}</h1>
              <p className="sub">
                {round ? `${keyName(key.root, key.mode)} · ${voices} ${voices === 1 ? 'voice' : 'voices'} · ${remaining > 0 ? `ends in ${clock(remaining)}` : 'ending…'}` : loadErr ?? 'Reading the chain…'}
              </p>
            </div>
          </div>

          <div className="staff-wrap">
            <Staff
              ref={player.staff}
              song={song}
              byId={byId}
              brush={canSing ? brush : null}
              onPlace={place}
              onRemove={() => undefined}
              pending={cell && brush ? { ...cell, chog: brush } : null}
            />
            {round && voices === 0 && (
              <div className="empty-note"><span>Nobody has sung this round.</span><span>Be the first.</span></div>
            )}
          </div>

          <Dock song={song} playing={player.playing} onToggle={player.toggle} onChange={p => setControls(c => ({ ...c, ...p }))} keyLocked />
          <p className="fine">The key changes every round. The chain picks it, so everyone sings in the same one. A round lasts {d.epochSeconds >= 3600 ? `${d.epochSeconds / 3600} hour${d.epochSeconds === 3600 ? '' : 's'}` : `${Math.round(d.epochSeconds / 60)} minutes`} here.</p>
        </section>

        <aside className="side">
          <section className="voicecard sing">
            <h2>Sing with your Chog</h2>
            <p className="rule">One Chog, one note, once a round. Only the Chog&apos;s owner can place it.</p>
            <WalletPanel wallet={wallet} chain={target.chain} why="Connect a wallet to put a Chog in the choir." />

            {session && (
              <>
                {empty && target.chain.id === 10143 && (
                  <p className="w-err" role="status">This wallet has no testnet MON for gas. Get some from the <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">Monad faucet</a>, then come back.</p>
                )}
                <div className="mine">
                  <h3>Your Chogs on {target.chain.name}</h3>
                  {held === null ? (
                    <p className="w-note">Looking…</p>
                  ) : mine.length === 0 ? (
                    <p className="w-note">You hold none here yet. This testnet copy is free to claim.</p>
                  ) : (
                    <div className="thumbs row">
                      {mine.map(id => {
                        const c = byId.get(id)!
                        return (
                          <button key={id} className={`thumb v${c.spec.vowel} ${brushId === id ? 'sel' : ''} ${sung.has(id) ? 'done' : ''}`} onClick={() => pick(c)} title={sung.has(id) ? `#${c.n} already sang this round` : `#${c.n} · ${VOWELS[c.spec.vowel].toLowerCase()}`}>
                            <img src={thumb(c.n)} alt={`Chog #${c.n}`} draggable={false} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <button className="btn" disabled={!!busy} onClick={claimRandom}>{mine.length === 0 ? 'Claim a free Chog' : 'Claim another'}</button>
                </div>

                {realHeld.length > 0 && (
                  <div className="mine">
                    <h3>Your real Chogs on Monad</h3>
                    <p className="w-note">You hold {realHeld.length} on mainnet. Tap one to claim the same Chog on testnet.</p>
                    <div className="thumbs row">
                      {realHeld.map(id => {
                        const c = byId.get(id)!
                        return (
                          <button key={id} className={`thumb v${c.spec.vowel} ${mine.includes(id) ? 'done' : ''}`} disabled={!!busy} onClick={() => (mine.includes(id) ? pick(c) : claim(id))} title={`#${c.n}`}>
                            <img src={thumb(c.n)} alt={`Chog #${c.n}`} draggable={false} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="act">
                  {!brush ? (
                    <p className="w-note">{free.length > 0 ? 'Pick one of your Chogs, then tap a cell on the staff.' : mine.length > 0 ? 'All your Chogs have sung this round.' : ''}</p>
                  ) : sung.has(brush.id) ? (
                    <p className="w-note">Chog #{brush.n} already sang this round.</p>
                  ) : !held?.includes(brush.id) ? (
                    <p className="w-note">Chog #{brush.n} is not in this wallet.</p>
                  ) : !cell ? (
                    <p className="w-note">Chog #{brush.n} sings “{VOWELS[brush.spec.vowel].toLowerCase()}”. Tap a cell on the staff to choose its note.</p>
                  ) : (
                    <button className="btn solid big" disabled={!!busy || !canSing} onClick={sing}>{busy ?? `Sing Chog #${brush.n}`}</button>
                  )}
                  {lastTx && explorer && <a className="txlink" href={`${explorer}/tx/${lastTx}`} target="_blank" rel="noreferrer">View your transaction</a>}
                </div>
              </>
            )}
          </section>
        </aside>
      </main>
      {toast}
      <span hidden>{chogs.length}</span>
    </>
  )
}
