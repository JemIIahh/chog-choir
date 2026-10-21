import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits, type Address } from 'viem'
import { VOWELS } from '../audio/voice'
import type { Player } from '../audio/usePlayer'
import {
  approveToken, claimChog, encoreNote, encoresOn, explain, isClaimed, makeReader, placeMany, placeNote, readCollective, readEncored, readHeld, readLoft,
  readPrice, readRound, readSung, readToken, tokenFaucet, type LoftStat, type Reader, type Round,
} from '../chain/client'
import { monadMainnet, REAL_CHOG, type Deployment, type Net, type Target } from '../chain/config'
import { useWallet } from '../chain/useWallet'
import { Dock } from '../components/Dock'
import { Loft } from '../components/Loft'
import { NetSwitch } from '../components/NetSwitch'
import { Staff } from '../components/Staff'
import { WalletPanel } from '../components/WalletPanel'
import { thumb, type Chog } from '../data/chogs'
import { autoNotes, chunk, previewOrder, previewVoices } from '../lib/choirnotes'
import { epochKey, keyName } from '../lib/music'
import { type Song } from '../lib/share'
import { useClip } from '../lib/useClip'
import { useToast } from '../lib/useToast'

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}

/** The band builds as more Chogs sing: voices alone, then a pad, then bass, then drums. */
export const LAYERS = [
  { at: 0, name: 'voices' },
  { at: 5, name: 'a pad' },
  { at: 25, name: 'bass' },
  { at: 100, name: 'drums' },
] as const
export const layersFor = (singers: number) => LAYERS.reduce((n, l, i) => (singers >= l.at ? i : n), 0)

export function NotDeployed({ what }: { what?: string }) {
  return (
    <main className="layout">
      <section className="stage">
        <h1>{what ?? 'The Choir'} opens soon</h1>
        <p className="sub">The contract is not deployed on this build yet. Songs and the Studio work without it.</p>
      </section>
    </main>
  )
}

type ChoirProps = { chogs: Chog[]; byId: Map<number, Chog>; player: Player; targets: Record<Net, Target>; net: Net; setNet(n: Net): void }

export function Choir(props: ChoirProps) {
  const target = props.targets[props.net]
  if (!target.deployment) return <NotDeployed />
  return <LiveChoir key={props.net} {...props} target={target} d={target.deployment} />
}

type Cell = { step: number; pitch: number }

function LiveChoir({ chogs, byId, player, target, d, targets, net, setNet }: ChoirProps & { target: Target; d: Deployment }) {
  const reader = useMemo<Reader>(() => makeReader(target), [target])
  const wallet = useWallet(target.chain)
  const { session } = wallet
  const { flash, node: toast } = useToast()
  const clip = useClip(player, byId, flash)

  const [round, setRound] = useState<Round | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now() / 1000)
  const offset = useRef(0)

  const [stats, setStats] = useState<LoftStat[] | null>(null)
  const [collective, setCollective] = useState<{ voices: number; singers: number; burned: bigint }>({ voices: 0, singers: 0, burned: 0n })
  const [previewTo, setPreviewTo] = useState<number | null>(null) // null = the live round

  const [controls, setControls] = useState({ tempo: 84, space: 55, bright: 55, beat: 1 })
  const [held, setHeld] = useState<number[] | null>(null)
  const [realHeld, setRealHeld] = useState<number[]>([])
  const [sung, setSung] = useState<Set<number>>(new Set())
  const [encored, setEncored] = useState<Set<number>>(new Set())
  const [tok, setTok] = useState<{ balance: bigint; allowance: bigint } | null>(null)
  const [brushId, setBrushId] = useState<number | null>(null)
  const [cell, setCell] = useState<Cell | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastTx, setLastTx] = useState<string | null>(null)
  const [noGas, setNoGas] = useState(false)

  const [chainPrice, setChainPrice] = useState<bigint | null>(null)
  const price = chainPrice ?? BigInt(d.encorePrice)
  const priceText = Number(formatUnits(price, 18)).toLocaleString()
  const encores = encoresOn(d)
  const sandbox = !!d.faucet // testnet copy: free Chogs and free test tokens
  const say = useCallback((e: unknown) => explain(e, { testnet: !!d.faucet }), [d.faucet])

  // ── the round and the community, straight from the chain
  const refresh = useCallback(async () => {
    try {
      const r = await readRound(reader, d)
      offset.current = r.now - Date.now() / 1000
      setRound(r)
      setLoadErr(null)
    } catch (e) {
      setLoadErr(say(e))
    }
  }, [reader, d, say])

  const refreshStats = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([readLoft(reader, d, chogs.length), readCollective(reader, d)])
      setStats(s)
      setCollective(c)
    } catch { /* the loft stays as it was */ }
  }, [reader, d, chogs.length])

  useEffect(() => { if (encoresOn(d)) void readPrice(reader, d).then(setChainPrice).catch(() => undefined) }, [reader, d])

  useEffect(() => {
    void refresh()
    void refreshStats()
    const poll = window.setInterval(refresh, 6000)
    const slow = window.setInterval(refreshStats, 20000)
    const tick = window.setInterval(() => setNow(Date.now() / 1000 + offset.current), 500)
    return () => { window.clearInterval(poll); window.clearInterval(slow); window.clearInterval(tick) }
  }, [refresh, refreshStats])

  const remaining = round ? round.end - now : 0
  useEffect(() => { if (round && remaining <= -1) void refresh() }, [round, remaining, refresh])

  const key = useMemo(() => (round ? epochKey(round.epoch) : { root: 0, mode: 0 }), [round])

  // "what if more Chogs sang": stand-in voices for Chogs that have not, played and drawn but never sent to the chain
  const order = useMemo(() => previewOrder(chogs), [chogs])
  const roundIds = useMemo(() => new Set((round?.notes ?? []).map(n => n.id)), [round?.notes])
  const live = roundIds.size
  const previewing = previewTo !== null && previewTo > live
  const stand = useMemo(() => (previewing ? previewVoices(order, previewTo! - live, roundIds, round?.notes ?? []) : []), [previewing, previewTo, live, order, roundIds, round?.notes])
  const singersNow = previewing ? Math.max(collective.singers, previewTo!) : collective.singers
  const layers = layersFor(singersNow)
  const notes = useMemo(() => (stand.length ? [...(round?.notes ?? []), ...stand] : round?.notes ?? []), [stand, round?.notes])
  const song: Song = useMemo(() => ({ ...controls, ...key, layers, notes }), [controls, key, layers, notes])
  const loftStats = useMemo(() => {
    if (!stats || stand.length === 0 || !round) return stats
    const next = stats.slice()
    for (const n of stand) { const st = next[n.id - 1]; next[n.id - 1] = { total: st.total + 1, last: round.epoch + 1, streak: Math.max(1, st.streak), best: Math.max(1, st.best) } }
    return next
  }, [stats, stand, round])
  useEffect(() => { player.bind(song) }, [song, player])

  // ── who this wallet can sing for
  const loadHeld = useCallback(async () => {
    if (!session) { setHeld(null); setRealHeld([]); return }
    try { setHeld(await readHeld(reader, d.nft, session.account)) } catch { setHeld([]) }
    // on the sandbox, real holders on Monad can bring their own Chogs over
    if (sandbox) {
      try { setRealHeld(await readHeld(makeReader({ chain: monadMainnet, deployment: null }), REAL_CHOG as Address, session.account)) } catch { setRealHeld([]) }
    }
  }, [session, reader, d.nft, sandbox])
  useEffect(() => { void loadHeld() }, [loadHeld])

  const loadToken = useCallback(async () => {
    if (!session || !encores) { setTok(null); return }
    try { setTok(await readToken(reader, d, session.account)) } catch { setTok(null) }
  }, [session, encores, reader, d])
  useEffect(() => { void loadToken() }, [loadToken, lastTx])

  useEffect(() => {
    if (!session) { setNoGas(false); return }
    void reader.pub.getBalance({ address: session.account }).then(b => setNoGas(b === 0n)).catch(() => setNoGas(false))
  }, [session, reader, lastTx, held?.length])

  useEffect(() => {
    if (!round || !held) { setSung(new Set()); setEncored(new Set()); return }
    void readSung(reader, d, round.epoch, held).then(setSung).catch(() => setSung(new Set()))
    void readEncored(reader, d, round.epoch, held).then(setEncored).catch(() => setEncored(new Set()))
  }, [round?.epoch, round?.notes.length, held, reader, d]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => held ?? [], [held])
  const mineSet = useMemo(() => new Set(mine), [mine])
  const free = useMemo(() => mine.filter(id => !sung.has(id)), [mine, sung])
  const brush = brushId ? byId.get(brushId) ?? null : null
  const owns = !!(brush && held?.includes(brush.id))
  const canSing = !!(session && brush && owns && !sung.has(brush.id))
  const canEncore = !!(session && brush && owns && encores && sung.has(brush.id) && !encored.has(brush.id))
  const aliveStreak = (id: number) => { const st = stats?.[id - 1]; return st && round && st.last >= round.epoch ? st.streak : 0 }

  const pick = useCallback((c: Chog) => {
    setBrushId(c.id)
    setCell(null)
    player.hear(c, Math.round((c.spec.low + c.spec.high) / 2))
  }, [player])

  const place = useCallback((step: number, pitch: number) => {
    if (!brush) { flash(session ? 'Pick one of your Chogs first.' : 'Connect a wallet to sing. You can still listen.'); return }
    setCell({ step, pitch })
    player.hear(brush, pitch)
  }, [brush, session, flash, player])

  const after = useCallback(async (hash: string) => {
    setLastTx(hash)
    setCell(null)
    await Promise.all([refresh(), refreshStats()])
  }, [refresh, refreshStats])

  const sing = useCallback(async () => {
    if (!session || !brush || !cell) return
    setBusy('Sending to your wallet…')
    try {
      await after(await placeNote(reader, session, d, brush.id, cell.step, cell.pitch))
      flash(`Chog #${brush.n} is in the choir.`)
    } catch (e) { flash(say(e)) } finally { setBusy(null) }
  }, [session, brush, cell, reader, d, after, flash])

  const singAll = useCallback(async () => {
    if (!session || !round) return
    const todo = free.map(id => byId.get(id)).filter((c): c is Chog => !!c)
    const batches = chunk(autoNotes(todo, round.notes), 25)
    let done = 0
    try {
      for (const b of batches) {
        setBusy(`Singing ${done + 1}–${done + b.length} of ${todo.length}…`)
        await after(await placeMany(reader, session, d, b))
        done += b.length
      }
      flash(done === 1 ? 'Your Chog is in the choir.' : `${done} of your Chogs are in the choir.`)
    } catch (e) {
      flash(done > 0 ? `${done} Chogs sang, then it stopped: ${say(e)}` : say(e))
    } finally { setBusy(null) }
  }, [session, round, free, byId, reader, d, after, flash, say])

  const encore = useCallback(async () => {
    if (!session || !brush || !cell) return
    try {
      if (!tok || tok.allowance < price) {
        setBusy('Approve $CHOG in your wallet…')
        await approveToken(reader, session, d, price)
        await loadToken()
      }
      setBusy('Burning $CHOG for the encore…')
      await after(await encoreNote(reader, session, d, brush.id, cell.step, cell.pitch))
      flash(`Encore! Chog #${brush.n} sings again. ${priceText} $CHOG burned.`)
    } catch (e) { flash(say(e)) } finally { setBusy(null) }
  }, [session, brush, cell, tok, price, priceText, reader, d, after, loadToken, flash])

  const getTokens = useCallback(async () => {
    if (!session) return
    setBusy('Getting test $CHOG…')
    try { await tokenFaucet(reader, session, d); await loadToken(); flash('1,000 test $CHOG added.') } catch (e) { flash(say(e)) } finally { setBusy(null) }
  }, [session, reader, d, loadToken, flash])

  const claim = useCallback(async (id: number) => {
    if (!session) return
    setBusy('Claiming…')
    try {
      if (await isClaimed(reader, d.nft, id)) { flash(`Chog #${byId.get(id)?.n ?? id} is already claimed on testnet.`); return }
      await claimChog(reader, session, d, id)
      await loadHeld()
      setBrushId(id)
      flash(`Claimed Chog #${byId.get(id)?.n ?? id}. It is yours on testnet.`)
    } catch (e) { flash(say(e)) } finally { setBusy(null) }
  }, [session, reader, d, byId, loadHeld, flash])

  const claimRandom = useCallback(async () => {
    if (!session) return
    setBusy('Finding a free Chog…')
    try {
      for (let i = 0; i < 12; i++) {
        const id = 1 + Math.floor(Math.random() * chogs.length)
        if (!(await isClaimed(reader, d.nft, id))) { setBusy(null); return void (await claim(id)) }
      }
      flash('Could not find a free Chog just now. Try again.')
    } finally { setBusy(null) }
  }, [session, reader, d.nft, chogs.length, claim, flash])

  const voices = notes.length // what the staff shows, preview included
  const realVoices = round?.notes.length ?? 0 // what is on the chain
  const explorer = target.chain.blockExplorers?.default.url
  const nextLayer = LAYERS.find(l => singersNow < l.at)
  const lowToken = !!tok && tok.balance < price
  const doneFor = (id: number) => sung.has(id) && !(encores && !encored.has(id))

  return (
    <>
      <main className="layout">
        <section className="stage" aria-label="The Choir">
          <div className="stage-head">
            <div>
              <h1>{round ? `Round ${round.epoch + 1}` : 'The Choir'}</h1>
              <p className="sub">
                {round ? `${keyName(key.root, key.mode)} · ${realVoices} ${realVoices === 1 ? 'voice' : 'voices'}${previewing ? ' (+ preview)' : ''} · ${remaining > 0 ? `ends in ${clock(remaining)}` : 'ending…'}` : loadErr ?? 'Reading the chain…'}
              </p>
            </div>
            <NetSwitch targets={targets} net={net} onChange={setNet} />
          </div>

          <div className="community">
            <div className="c-nums">
              <b>{singersNow.toLocaleString()}</b> of {chogs.length.toLocaleString()} Chogs {previewing ? 'singing (preview)' : 'have sung'}
              <span>{collective.voices.toLocaleString()} voices so far</span>
              {encores && collective.burned > 0n && <span className="burned">{Number(formatUnits(collective.burned, 18)).toLocaleString()} $CHOG burned</span>}
            </div>
            <div className="c-meter" aria-hidden>
              <i style={{ width: `${Math.min(100, (singersNow / (nextLayer?.at ?? chogs.length)) * 100)}%` }} />
            </div>
            <p className="c-next">
              {nextLayer
                ? `${nextLayer.at - singersNow} more ${nextLayer.at - singersNow === 1 ? 'Chog' : 'Chogs'} and ${nextLayer.name} join the choir.`
                : 'The whole band is playing. Every Chog that sings keeps it going.'}
              {' '}Right now: {LAYERS.slice(0, layers + 1).map(l => l.name).join(', ')}.
            </p>
          </div>

          <Loft chogs={chogs} stats={loftStats} epoch={round?.epoch ?? null} mine={mineSet} selectedId={brushId} onPick={c => (mineSet.has(c.id) ? pick(c) : player.hear(c, Math.round((c.spec.low + c.spec.high) / 2)))} />

          <div className="staff-wrap">
            <Staff
              ref={player.staff}
              song={song}
              byId={byId}
              brush={canSing || canEncore ? brush : null}
              onPlace={place}
              onRemove={n => place(n.step, n.pitch)} // a crowded cell is still a cell: notes stack there, as the +N badge shows
              pending={cell && brush ? { ...cell, chog: brush } : null}
            />
            {round && voices === 0 && (
              <div className="empty-note"><span>Nobody has sung this round.</span><span>Be the first.</span></div>
            )}
          </div>

          <Dock song={song} playing={player.playing} onToggle={player.toggle} onChange={p => setControls(c => ({ ...c, ...p }))} keyLocked>
            <button className="btn dark" onClick={() => clip.save({ ...song, layers }, `Round ${(round?.epoch ?? 0) + 1}${previewing ? ' preview' : ''}`)} disabled={clip.progress !== null || voices === 0}>{clip.progress !== null ? `Recording ${Math.round(clip.progress * 100)}%` : 'Save clip'}</button>
          </Dock>
          <label className={`fill ${previewing ? 'on' : ''}`}>
            <span className="fill-top">
              <span>What if more Chogs sing?</span>
              <output>{previewing ? `${previewTo} Chogs · preview, not on the chain` : `${live} ${live === 1 ? 'Chog' : 'Chogs'} · live`}</output>
            </span>
            <input type="range" min={0} max={400} value={previewTo ?? live} aria-label="Preview a bigger choir" onChange={e => { const v = Number(e.target.value); setPreviewTo(v > live ? v : null) }} style={{ ['--p' as string]: `${((previewTo ?? live) / 400) * 100}%` } as React.CSSProperties} />
            {previewing && <button type="button" className="btn small" onClick={() => setPreviewTo(null)}>Back to live</button>}
          </label>
          <p className="fine">The chain picks each round&apos;s key, so everyone sings in the same one. A round lasts {d.epochSeconds >= 3600 ? `${d.epochSeconds / 3600} ${d.epochSeconds === 3600 ? 'hour' : 'hours'}` : `${Math.round(d.epochSeconds / 60)} minutes`}.</p>
        </section>

        <aside className="side">
          <section className="voicecard sing">
            <h2>Sing with your Chog</h2>
            <p className="rule">One Chog, one note, once a round. Only the Chog&apos;s owner can place it. Sing every round to build a streak.</p>
            <WalletPanel wallet={wallet} chain={target.chain} why={sandbox ? 'Connect a wallet to put a Chog in the choir.' : 'Connect the wallet that holds your Chogs.'} />

            {session && (
              <>
                {noGas && (
                  <p className="w-err" role="status">
                    This wallet has no {target.chain.nativeCurrency.symbol} for gas.
                    {target.chain.id === 10143 && <> Get some free from the <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">Monad faucet</a> or the <a href="https://www.alchemy.com/faucets/monad-testnet" target="_blank" rel="noreferrer">Alchemy faucet</a> (no sign-up), then come back.</>}
                  </p>
                )}
                <div className="mine">
                  <h3>Your Chogs on {target.chain.name}</h3>
                  {held === null ? (
                    <p className="w-note">Looking…</p>
                  ) : mine.length === 0 ? (
                    <p className="w-note">{sandbox ? 'You hold none here yet. This testnet copy is free to claim.' : 'This wallet holds no Chog Genesis. Switch to the free testnet copy to try it.'}</p>
                  ) : (
                    <div className={`thumbs row ${mine.length > 10 ? 'many' : ''}`}>
                      {mine.map(id => {
                        const c = byId.get(id)!
                        const st = aliveStreak(id)
                        return (
                          <button key={id} className={`thumb v${c.spec.vowel} ${brushId === id ? 'sel' : ''} ${doneFor(id) ? 'done' : ''}`} onClick={() => pick(c)} title={sung.has(id) ? `#${c.n} sang this round${st > 1 ? ` · ${st} in a row` : ''}` : `#${c.n} · ${VOWELS[c.spec.vowel].toLowerCase()}`}>
                            <img src={thumb(c.n)} alt={`Chog #${c.n}`} draggable={false} />
                            {st > 1 && <span className="streak">{st}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {sandbox && <button className="btn" disabled={!!busy} onClick={claimRandom}>{mine.length === 0 ? 'Claim a free Chog' : 'Claim another'}</button>}
                </div>

                {sandbox && realHeld.length > 0 && (
                  <div className="mine">
                    <h3>Your real Chogs on Monad</h3>
                    <p className="w-note">You hold {realHeld.length} on mainnet. Sing with them for real, or tap one to claim the same Chog on testnet.</p>
                    {targets.main.deployment && <button className="btn solid" onClick={() => setNet('main')}>Sing with my real Chogs on Monad</button>}
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
                  {free.length >= 2 && (
                    <button className="btn solid big" disabled={!!busy} onClick={singAll}>
                      {busy?.startsWith('Singing') ? busy : `Sing with all ${free.length} of your Chogs`}
                    </button>
                  )}
                  {free.length >= 2 && !brush && <p className="w-note">Each Chog sings a note from its own phrase, {free.length > 25 ? `${Math.ceil(free.length / 25)} transactions of up to 25 Chogs` : 'in one transaction'}. Or pick one Chog and place its note by hand.</p>}
                  {!brush ? (
                    <p className="w-note">{free.length > 0 ? 'Pick one of your Chogs, then tap a cell on the staff.' : mine.length > 0 ? (encores ? 'All your Chogs have sung this round. Pick one to take an encore.' : 'All your Chogs have sung this round.') : ''}</p>
                  ) : !owns ? (
                    <p className="w-note">Chog #{brush.n} is not in this wallet.</p>
                  ) : canSing ? (
                    !cell ? (
                      <p className="w-note">Chog #{brush.n} sings “{VOWELS[brush.spec.vowel].toLowerCase()}”. Tap a cell on the staff to choose its note.</p>
                    ) : (
                      <button className="btn solid big" disabled={!!busy} onClick={sing}>{busy ?? `Sing Chog #${brush.n}`}</button>
                    )
                  ) : canEncore ? (
                    <>
                      <p className="w-note">Chog #{brush.n} sang this round. {cell ? '' : `Tap a cell for an encore: it burns ${priceText} $CHOG.`}</p>
                      {cell && (
                        <button className="btn solid big" disabled={!!busy || lowToken} onClick={encore}>
                          {busy ?? (tok && tok.allowance < price ? `Approve, then burn ${priceText} $CHOG` : `Encore: burn ${priceText} $CHOG`)}
                        </button>
                      )}
                      {lowToken && <p className="w-note">You need {priceText} $CHOG for an encore. {sandbox ? 'Test tokens are free:' : 'It trades on Monad.'}</p>}
                      {lowToken && sandbox && <button className="btn" disabled={!!busy} onClick={getTokens}>Get 1,000 test $CHOG</button>}
                    </>
                  ) : (
                    <p className="w-note">{encored.has(brush.id) ? `Chog #${brush.n} already took its encore this round.` : `Chog #${brush.n} already sang this round.`}</p>
                  )}
                  {lastTx && explorer && <a className="txlink" href={`${explorer}/tx/${lastTx}`} target="_blank" rel="noreferrer">View your transaction</a>}
                </div>
              </>
            )}
          </section>
        </aside>
      </main>
      {toast}
    </>
  )
}
