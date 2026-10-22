import { useState } from 'react'
import { useWalletCtx } from '../chain/WalletContext'
import { WalletIcon } from './WalletIcon'

/** The wallets found in this browser as rows: icon, name, a hint. Used by the connect modal, the welcome and the Choir. */
export function WalletChooser({ onDone }: { onDone?(): void }) {
  const { wallets, busy, error, connect, last, privy } = useWalletCtx()
  const [pending, setPending] = useState<string | null>(null)

  // sign in with email or Google (only when a Privy app id is configured): no crypto wallet needed
  const email = privy.enabled ? (
    <button className="wrow" disabled={busy} onClick={async () => { setPending('email'); const ok = await privy.start(); setPending(null); if (ok) onDone?.() }}>
      <span className="wicon wglyph wmail" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="6" width="17" height="12" rx="3" /><path d="M5 8.5l7 5 7-5" /></svg>
      </span>
      <span className="wtext">
        <b>{privy.label}</b>
        <small>{busy && pending === 'email' ? 'Waiting for sign-in…' : 'No crypto wallet needed'}</small>
      </span>
      {busy && pending === 'email' ? <span className="spin" aria-hidden /> : (
        <svg className="wchev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
      )}
    </button>
  ) : null

  if (wallets === null)
    return (
      <div className="w-rows" aria-busy="true" aria-label="Looking for wallets">
        <div className="wskel" /><div className="wskel" />
      </div>
    )
  if (wallets.length === 0)
    return (
      <>
      {email && <div className="w-rows">{email}</div>}
      {error && email && <p className="w-err" role="alert">{error}</p>}
      <div className="wempty">
        <WalletIcon size={52} />
        <b>No wallet found in this browser</b>
        <p>{email ? 'Sign in with email above, or install a wallet and reload this page. You can still listen to everything here.' : 'You can still listen to everything here. To sing, install a wallet, then reload this page.'}</p>
        <div className="wget">
          <a className="btn small" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask</a>
          <a className="btn small" href="https://rabby.io/" target="_blank" rel="noreferrer">Get Rabby</a>
        </div>
      </div>
      </>
    )
  // the one used last time first
  const list = [...wallets].sort((a, b) => Number((b.rdns ?? b.name) === last) - Number((a.rdns ?? a.name) === last))
  return (
    <>
      <div className="w-rows" role="list">
        {email}
        {list.map(w => {
          const id = w.rdns ?? w.name
          const waiting = busy && pending === id
          return (
            <button key={id} role="listitem" className="wrow" disabled={busy} onClick={async () => { setPending(id); const ok = await connect(w); setPending(null); if (ok) onDone?.() }}>
              <WalletIcon w={w} />
              <span className="wtext">
                <b>{w.name}</b>
                <small>{waiting ? 'Waiting for your wallet…' : id === last ? 'Last used' : 'Detected'}</small>
              </span>
              {waiting ? <span className="spin" aria-hidden /> : (
                <svg className="wchev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
              )}
            </button>
          )
        })}
      </div>
      {error && <p className="w-err" role="alert">{error}</p>}
    </>
  )
}
