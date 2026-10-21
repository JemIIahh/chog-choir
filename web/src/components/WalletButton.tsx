import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWalletCtx } from '../chain/WalletContext'
import { monadMainnet } from '../chain/config'
import { thumb, type Chog } from '../data/chogs'
import { WalletChooser } from './WalletChooser'
import { WalletIcon } from './WalletIcon'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** The one place to connect a wallet: top right, on every page. */
export function WalletButton({ byId }: { byId: Map<number, Chog> }) {
  const { account, found, menuOpen: open, setMenuOpen: setOpen } = useWalletCtx()
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // the account card is a dropdown: close it on a click outside or Escape
  useEffect(() => {
    if (!open || !account) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open, account, setOpen])

  return (
    <div className="wallet-wrap" ref={box}>
      <button ref={trigger} className={`btn wbtn ${account ? '' : 'solid'}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        {account ? (
          <>
            <span className="wmini"><WalletIcon w={found} size={20} /><i className="wdot" /></span>
            {short(account)}
          </>
        ) : 'Connect wallet'}
      </button>
      {open && account && <AccountCard byId={byId} close={() => setOpen(false)} />}
      {open && !account && <ConnectModal close={() => { setOpen(false); trigger.current?.focus() }} />}
    </div>
  )
}

/** Connecting: a centred modal over a dimmed page. */
function ConnectModal({ close }: { close(): void }) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('button.wrow, .wm-x')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const f = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
      if (f.length === 0) return
      const first = f[0], lastEl = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key) }
  }, [close])

  return createPortal(
    <div className="wmodal-back" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="wmodal" role="dialog" aria-modal="true" aria-labelledby="wm-title" ref={panel}>
        <div className="wm-head">
          <h2 id="wm-title">Connect a wallet</h2>
          <button className="wm-x" onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="wm-sub">See your Chogs and sing in the Choir.</p>
        <WalletChooser onDone={close} />
        <p className="wm-fine">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
          Connecting only reads which Chogs you hold. Nothing is signed or sent until you sing.
        </p>
      </div>
    </div>,
    document.body,
  )
}

/** Connected: a card under the button with the account, your Chogs and the exits. */
function AccountCard({ byId, close }: { byId: Map<number, Chog>; close(): void }) {
  const { account, found, held, disconnect } = useWalletCtx()
  const [copied, setCopied] = useState(false)
  if (!account) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(account); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { /* the address is selectable anyway */ }
  }
  const open = (n: number) => { location.hash = `#c=${n}`; close() }
  const shown = held?.slice(0, 5) ?? []
  const more = (held?.length ?? 0) - shown.length
  return (
    <div className="wmenu" role="dialog" aria-label="Wallet">
      <div className="acct-head">
        <WalletIcon w={found} size={40} />
        <div>
          <b>{found?.name ?? 'Wallet'}</b>
          <span className="acct-status"><i className="wdot" />Connected</span>
        </div>
      </div>
      <div className="acct-addr">
        <code title={account}>{short(account)}</code>
        <button className="btn small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="acct-chogs">
        <h3>Your Chogs</h3>
        {held === null ? (
          <div className="wskel slim" aria-label="Looking for your Chogs" />
        ) : held.length === 0 ? (
          <p className="w-note">None in this wallet yet. Type any number on Songs to hear one.</p>
        ) : (
          <>
            <p className="w-note">{held.length} Chog Genesis. Tap one to hear its song.</p>
            <div className="acct-row">
              {shown.map(id => {
                const c = byId.get(id)
                return c ? (
                  <button key={id} className={`acct-chog v${c.spec.vowel}`} onClick={() => open(c.n)} title={`Chog #${c.n}`} aria-label={`Open Chog #${c.n}`}>
                    <img src={thumb(c.n)} alt="" draggable={false} />
                  </button>
                ) : null
              })}
              {more > 0 && <span className="acct-more">+{more}</span>}
            </div>
          </>
        )}
      </div>
      <div className="acct-actions">
        <a className="btn small" href={`${monadMainnet.blockExplorers.default.url}/address/${account}`} target="_blank" rel="noreferrer">View on explorer</a>
        <button className="btn small" onClick={() => { disconnect(); close() }}>Disconnect</button>
      </div>
    </div>
  )
}
