import { voiceFor, type VoiceSpec, type Why } from '../audio/voice'

export type Chog = {
  id: number // on-chain token id (1..1969)
  n: number // the number in the Chog's name and artwork, "CHOG #n"
  traits: Record<string, string>
  spec: VoiceSpec
  why: Why[]
}

type Manifest = {
  contract: string
  chainId: number
  supply: number
  traits: string[]
  values: string[][]
  rows: number[][] // [id, n, ...value index per trait, -1 when the trait is absent]
}

export const thumb = (n: number) => `${import.meta.env.BASE_URL}chogs/${n}.webp`
export const thumbLg = (n: number) => `${import.meta.env.BASE_URL}chogs/lg/${n}.webp`

export async function loadChogs(): Promise<Chog[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/chogs.json`)
  if (!res.ok) throw new Error(`could not load the Chog list (${res.status})`)
  const m: Manifest = await res.json()
  return m.rows.map(row => {
    const traits: Record<string, string> = {}
    m.traits.forEach((t, i) => {
      const v = row[2 + i]
      if (v >= 0) traits[t] = m.values[i][v]
    })
    const { spec, why } = voiceFor(traits)
    return { id: row[0], n: row[1], traits, spec, why }
  })
}
