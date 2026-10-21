import { useCallback, useState } from 'react'

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const flash = useCallback((m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(cur => (cur === m ? null : cur)), 2600)
  }, [])
  const node = <div className={`toast ${msg ? 'show' : ''}`} role="status">{msg}</div>
  return { flash, node }
}
