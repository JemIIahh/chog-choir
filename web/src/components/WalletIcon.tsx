import type { Found } from '../chain/wallet'

/** The wallet's own icon (announced by the wallet), or a plain wallet glyph. */
export function WalletIcon({ w, size = 36 }: { w?: Found | null; size?: number }) {
  if (w?.icon) return <img className="wicon" src={w.icon} alt="" width={size} height={size} style={{ width: size, height: size }} />
  return (
    <span className="wicon wglyph" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5A1.5 1.5 0 0 1 19 6.5V8" /><path d="M3.5 7.5V17A2.5 2.5 0 0 0 6 19.5h12.5a1.5 1.5 0 0 0 1.5-1.5v-8.5A1.5 1.5 0 0 0 18.5 8H6A2.5 2.5 0 0 1 3.5 7.5z" /><circle cx="16" cy="13.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}
