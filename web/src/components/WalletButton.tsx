import { useEffect, useRef } from 'react'
import { useWalletCtx } from '../chain/WalletContext'
import { WalletChooser } from './WalletChooser'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** The one place to connect a wallet: top right, on every page. */
export function WalletButton() {
  const { account, found, held, disconnect, menuOpen: open, setMenuOpen: setOpen } = useWalletCtx()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open, setOpen])

  return (
    <div className="wallet-wrap" ref={box}>
      <button className={`btn wbtn ${account ? '' : 'solid'}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        {account ? (<><span className="w-dot" />{short(account)}</>) : 'Connect wallet'}
      </button>
      {open && (
        <div className="wmenu" role="dialog" aria-label="Wallet">
          {account ? (
            <>
              <h3>{found?.name ?? 'Wallet'}</h3>
              <p className="w-id">{short(account)}</p>
              <p className="w-note">
                {held === null ? 'Looking for your Chogs…' : held.length === 0 ? 'No Chog Genesis in this wallet. Type any number on Songs to hear one.' : `${held.length} Chog Genesis in this wallet. Find them on Songs.`}
              </p>
              <button className="btn" onClick={() => { disconnect(); setOpen(false) }}>Disconnect</button>
            </>
          ) : (
            <>
              <h3>Connect a wallet</h3>
              <p className="w-note">To see your Chogs and sing in the Choir. Connecting only reads which Chogs you hold. Nothing is signed or sent.</p>
              <WalletChooser solid onDone={() => setOpen(false)} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
