import type { Net, Target } from '../chain/config'

/** Real Chogs on Monad, or the free testnet copy anyone can try. */
export function NetSwitch({ targets, net, onChange }: { targets: Record<Net, Target>; net: Net; onChange(n: Net): void }) {
  if (!targets.main.deployment || !targets.test.deployment) return null
  return (
    <div className="netswitch" role="group" aria-label="Network">
      <button className={net === 'main' ? 'on' : ''} aria-pressed={net === 'main'} onClick={() => onChange('main')}>Real Chogs on Monad</button>
      <button className={net === 'test' ? 'on' : ''} aria-pressed={net === 'test'} onClick={() => onChange('test')}>Try it free on testnet</button>
    </div>
  )
}
