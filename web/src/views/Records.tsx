import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/usePlayer'
import { explain, makeReader, readRound, readSealed, readWaiting, sealRound, type Sealed, type Waiting } from '../chain/client'
import type { Net, Target } from '../chain/config'
import { useWallet } from '../chain/useWallet'
import { Dock } from '../components/Dock'
import { NetSwitch } from '../components/NetSwitch'
import { Staff } from '../components/Staff'
import { WalletPanel } from '../components/WalletPanel'
import { thumb, type Chog } from '../data/chogs'
import { epochKey, keyName } from '../lib/music'
import type { Song } from '../lib/share'
import { useToast } from '../lib/useToast'
import { NotDeployed } from './Choir'

const when = (unix: number) => new Date(unix * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type RecordsProps = { byId: Map<number, Chog>; player: Player; targets: Record<Net, Target>; net: Net; setNet(n: Net): void }

export function Records(props: RecordsProps) {
  const target = props.targets[props.net]
  if (!target.deployment) return <NotDeployed what="Records" />
  return <Archive key={props.net} {...props} target={target} d={target.deployment} />
}

function Archive({ byId, player, target, d, targets, net, setNet }: RecordsProps & { target: Target; d: NonNullable<Target['deployment']> }) {
  const reader = useMemo(() => makeReader(target), [target])
  const wallet = useWallet(target.chain)
  const { flash, node: toast } = useToast()
  const [sealed, setSealed] = useState<Sealed[] | null>(null)
  const [waiting, setWaiting] = useState<Waiting[]>([])
  const [epochNow, setEpochNow] = useState(0)
  const [pickedEpoch, setPickedEpoch] = useState<number | null>(null)
  const [controls, setControls] = useState({ tempo: 84, space: 55, bright: 55, beat: 1 })
  const [busy, setBusy] = useState<number | null>(null)
  const [album, setAlbum] = useState(false) // playing every sealed round in turn
  const albumStart = useRef(false)
  const loopsHeard = useRef(0)

  const load = useCallback(async () => {
    try {
      const r = await readRound(reader, d)
      setEpochNow(r.epoch)
      const [s, w] = await Promise.all([readSealed(reader, d), readWaiting(reader, d, r.epoch)])
      setSealed(s)
      setWaiting(w)
    } catch (e) {
      flash(explain(e))
      setSealed(s => s ?? [])
    }
  }, [reader, d, flash])
  useEffect(() => { void load() }, [load])

  const picked = sealed?.find(s => s.epoch === pickedEpoch) ?? sealed?.[0] ?? null
  const key = useMemo(() => (picked ? epochKey(picked.epoch) : { root: 0, mode: 0 }), [picked])
  const song: Song = useMemo(() => ({ ...controls, ...key, notes: picked?.notes ?? [] }), [controls, key, picked])
  useEffect(() => { player.bind(song) }, [song, player])

  const seal = useCallback(async (epoch: number) => {
    if (!wallet.session) return
    setBusy(epoch)
    try {
      await sealRound(reader, wallet.session, d, epoch)
      flash(`Round ${epoch + 1} is sealed for good.`)
      await load()
      setPickedEpoch(epoch)
    } catch (e) {
      flash(explain(e))
    } finally {
      setBusy(null)
    }
  }, [wallet.session, reader, d, load, flash])

  const choose = (e: number) => { setAlbum(false); player.stop(); setPickedEpoch(e) }

  // the archive as a record: oldest round first, each sung twice, then the next
  const LOOPS_PER_ROUND = 2
  const order = useMemo(() => (sealed ? [...sealed].reverse().map(s => s.epoch) : []), [sealed])
  const pickedNow = useRef<number | null>(null)
  pickedNow.current = picked?.epoch ?? null
  const playAll = () => {
    if (order.length === 0) return
    player.stop()
    loopsHeard.current = 0
    albumStart.current = true
    setPickedEpoch(order[0])
    setAlbum(true)
  }
  useEffect(() => {
    // runs after the new round has been handed to the player, so the album starts on its first round
    if (album && albumStart.current) { albumStart.current = false; void player.toggle() }
  }, [album, picked?.epoch, player])
  useEffect(() => player.onStep(ev => {
    if (!album || ev.step !== 15) return
    loopsHeard.current++
    if (loopsHeard.current < LOOPS_PER_ROUND) return
    loopsHeard.current = 0
    const i = order.indexOf(pickedNow.current ?? -1)
    if (i >= 0 && i + 1 < order.length) setPickedEpoch(order[i + 1])
    else { setAlbum(false); player.stop() }
  }), [album, order, player])
  const albumAt = album && picked ? order.indexOf(picked.epoch) + 1 : 0

  return (
    <>
      <main className="layout">
        <section className="stage" aria-label="Records">
          <div className="stage-head">
            <div>
              <h1>{picked ? `Round ${picked.epoch + 1}` : 'Records'}</h1>
              <p className="sub">
                {picked
                  ? `${keyName(key.root, key.mode)} · ${picked.notes.length} ${picked.notes.length === 1 ? 'voice' : 'voices'} · sealed by ${short(picked.by)}${albumAt ? ` · playing ${albumAt} of ${order.length}` : ''}`
                  : sealed === null ? 'Reading the chain…' : 'Nothing sealed yet.'}
              </p>
            </div>
            <NetSwitch targets={targets} net={net} onChange={setNet} />
          </div>

          <div className="staff-wrap">
            <Staff ref={player.staff} song={song} byId={byId} brush={null} onPlace={() => undefined} onRemove={() => undefined} readOnly />
            {sealed && sealed.length === 0 && (
              <div className="empty-note"><span>No round is sealed yet.</span></div>
            )}
          </div>
          <Dock song={song} playing={player.playing} onToggle={() => { setAlbum(false); void player.toggle() }} onChange={p => setControls(c => ({ ...c, ...p }))} keyLocked>
            {order.length >= 2 && <button className="btn dark" onClick={playAll}>{album && player.playing ? `Playing all ${order.length}` : `Play all ${order.length} rounds`}</button>}
          </Dock>
          {picked && <p className="fine">Fingerprint {picked.hash.slice(0, 18)}… Anyone can check it: it is the hash of every note in this round, as the contract stored them.</p>}
        </section>

        <aside className="side">
          {waiting.length > 0 && (
            <section className="voicecard sing">
              <h2>Waiting to be sealed</h2>
              <p className="rule">A finished round is not final until someone seals it. Anyone can.</p>
              {!wallet.session && <WalletPanel wallet={wallet} chain={target.chain} why="Connect a wallet to seal a round." />}
              {wallet.session && <WalletPanel wallet={wallet} chain={target.chain} why="" />}
              <ul className="rounds">
                {waiting.map(w => (
                  <li key={w.epoch}>
                    <span><b>Round {w.epoch + 1}</b><small>{w.voices} {w.voices === 1 ? 'voice' : 'voices'}</small></span>
                    <button className="btn solid small" disabled={!wallet.session || busy !== null} onClick={() => seal(w.epoch)}>{busy === w.epoch ? 'Sealing…' : 'Seal it'}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="voicecard">
            <h2 className="side-h">Sealed rounds</h2>
            {sealed === null ? <p className="w-note">Reading the chain…</p> : sealed.length === 0 ? (
              <p className="w-note">When a round ends, anyone can seal it. It then lives here for good.{epochNow === 0 ? ' The first round is still being sung.' : ''}</p>
            ) : (
              <ul className="rounds">
                {sealed.map(s => (
                  <li key={s.epoch}>
                    <button className={`round ${picked?.epoch === s.epoch ? 'sel' : ''}`} onClick={() => choose(s.epoch)}>
                      <span className="faces">
                        {[...new Set(s.notes.map(n => n.id))].slice(0, 5).map(id => <img key={id} src={thumb(byId.get(id)!.n)} alt="" />)}
                      </span>
                      <span className="r-t"><b>Round {s.epoch + 1}</b><small>{keyName(epochKey(s.epoch).root, epochKey(s.epoch).mode)} · {s.notes.length} {s.notes.length === 1 ? 'voice' : 'voices'} · {when(s.start)}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
      {toast}
    </>
  )
}
