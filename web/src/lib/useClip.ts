import { useCallback, useState } from 'react'
import type { Player } from '../audio/usePlayer'
import type { Chog } from '../data/chogs'
import { recordClip } from './clip'
import { keyName } from './music'
import type { Song } from './share'

/** Records the current song to a video file and downloads it. */
export function useClip(player: Player, byId: Map<number, Chog>, flash: (m: string) => void) {
  const [progress, setProgress] = useState<number | null>(null)
  const save = useCallback(async (song: Song, title?: string, card?: Chog) => {
    if (song.notes.length === 0) { flash('Nothing to record yet. Put a Chog on the staff.'); return }
    player.stop()
    setProgress(0)
    try {
      const { blob, ext } = await recordClip({ song, byId, engine: player.getEngine(), title, card, onProgress: setProgress })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `chog-choir-${keyName(song.root, song.mode).replace(/\s+/g, '-')}.${ext}`
      a.click()
      flash(`Saved your clip (.${ext}).`)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not record the clip.')
    } finally {
      setProgress(null)
      player.stop()
    }
  }, [player, byId, flash])
  return { save, progress }
}
