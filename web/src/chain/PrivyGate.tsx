import { Component, lazy, Suspense, type ReactNode } from 'react'
import { privyMessages } from './privy'
import type { HostProps } from './PrivyHost'

// the Privy SDK is large: it is a separate download, fetched only when someone chooses email or Google
const PrivyHost = lazy(() => import('./PrivyHost'))

/** If the SDK cannot start (a bad app id, the download failing) the page carries on without it. */
class Guard extends Component<{ onGone(message?: string): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onGone(privyMessages.unavailable) }
  render() { return this.state.failed ? null : this.props.children }
}

export function PrivyGate(props: HostProps) {
  return (
    <Guard onGone={props.onGone}>
      <Suspense fallback={null}>
        <PrivyHost {...props} />
      </Suspense>
    </Guard>
  )
}
