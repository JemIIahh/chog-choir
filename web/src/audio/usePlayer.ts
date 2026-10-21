import { useCallback, useEffect, useRef, useState } from 'react'
import type { StaffHandle } from '../components/Staff'
import type { Chog } from '../data/chogs'
import { ChoirEngine } from './engine'
import type { Song } from '../lib/share'

/** One audio engine for the whole app. Views hand it the song they are showing; it plays that. */
export function usePlayer(byId: Map<number, Chog>) {
  const engine = useRef<ChoirEngine | null>(null)
  const staff = useRef<StaffHandle>(null)
  const song = useRef<Song>({ tempo: 88, root: 9, mode: 0, space: 46, bright: 52, notes: [] })
  const [playing, setPlaying] = useState(false)

  const specOf = useCallback((id: number) => byId.get(id)!.spec, [byId])

  const get = useCallback(() => {
    if (!engine.current) {
      const e = new ChoirEngine(song.current, specOf)
      e.onStep = ({ step, delay }) => staff.current?.hit(step, delay)
      engine.current = e
    }
    return engine.current
  }, [specOf])

  const bind = useCallback((s: Song) => {
    song.current = s
    engine.current?.setSong(s)
  }, [])

  const stop = useCallback(() => {
    engine.current?.stop()
    staff.current?.rest()
    setPlaying(false)
  }, [])

  const toggle = useCallback(async () => {
    const e = get()
    if (e.playing) return stop()
    await e.start()
    setPlaying(true)
  }, [get, stop])

  const hear = useCallback((c: Chog, pitch: number) => { void get().audition(c.spec, pitch, c.id) }, [get])

  useEffect(() => () => engine.current?.dispose(), [])

  const current = useCallback(() => song.current, [])
  return { staff, playing, toggle, stop, hear, bind, specOf, getEngine: get, current }
}

export type Player = ReturnType<typeof usePlayer>
