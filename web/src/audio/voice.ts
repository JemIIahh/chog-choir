// Turns a Chog's real traits into a singing voice. Pure and deterministic: same Chog, same voice, always.
// Traits that carry meaning are mapped by hand; the long tail (82 bodies, 49 hats...) falls back to a stable hash.

export type Traits = Record<string, string | undefined>

export const VOWELS = ['AH', 'EH', 'EE', 'OH', 'OO'] as const
export type Vowel = 0 | 1 | 2 | 3 | 4
export type Fx = 'none' | 'wobble' | 'grit' | 'shimmer' | 'echo' | 'smoke' | 'sub'
export type VoiceType = 'bass' | 'tenor' | 'alto' | 'soprano'

export type VoiceSpec = {
  vowel: Vowel
  voiceType: VoiceType
  size: number // formant scale: smaller bodies sing higher formants
  low: number // home staff rows, used when a phrase is generated
  high: number
  bright: number // 0..1
  vibRate: number // Hz
  vibDepth: number // cents
  breath: number // 0..1
  attack: number // seconds
  release: number // seconds
  fx: Fx
  unison: 1 | 2 | 3 | 4
  detune: number // cents between unison voices
  gain: number
  pan: number // -1..1
  space: number // 0..1 reverb send bias
  hollow: boolean // square-ish source for skulls and radioactive Chogs
  bare: boolean // sings without room reverb
}

/** One line per trait that shaped the voice, for the "why does it sound like that" card. */
export type Why = { trait: string; value: string; effect: string }

// ──────────────── helpers ────────────────

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** stable 0..1 from a string */
const unit = (s: string) => hash(s) / 4294967296
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const has = (v: string, ...words: string[]) => words.some(w => v.toLowerCase().includes(w.toLowerCase()))

// ──────────────── hand-made maps ────────────────

// Mouth shape → the vowel that mouth would make.
const MOUTH_VOWEL: Record<string, Vowel> = {
  'normal smile': 2,
  smile: 2,
  'gold tooth': 2,
  grit: 2,
  drooling: 0,
  'rainbow puke': 0,
  'clown mouth': 0,
  bubblegum: 4,
  sad: 3,
  wo: 3,
  'btc coin': 3,
  'mon coin': 3,
  worried: 1,
  'lip bite': 1,
  flat: 1,
}

const ACCESSORY_FX: Record<string, Fx> = {
  fwog: 'wobble',
  pepe: 'wobble',
  knife: 'grit',
  heart: 'shimmer',
  coin: 'shimmer',
  sb: 'sub',
  cigar: 'smoke',
  'red candle': 'echo',
  'green candle': 'echo',
}

const TIER_UNISON: Record<string, 1 | 2 | 3 | 4> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 4 }

function voiceTypeOf(body: string): VoiceType {
  if (has(body, 'tuxedo', 'suit', 'robe', 'jesus', 'guard', 'gangster', 'wizard', 'kings')) return 'bass'
  if (has(body, 'trackset', 'shirt', 'tee', 'vest', 'tank', 'jersey', 'inmate', 'prisoner', 'farmer', 'cwo')) return 'tenor'
  if (has(body, 'yukata', 'chinese', 'dragon', 'dress', 'banana', 'duck', 'float')) return 'alto'
  const u = unit('body:' + body)
  return u < 0.3 ? 'bass' : u < 0.6 ? 'tenor' : u < 0.82 ? 'alto' : 'soprano'
}

export const TYPE_SHAPE: Record<VoiceType, { size: number; low: number; high: number }> = {
  bass: { size: 0.86, low: 0, high: 5 },
  tenor: { size: 1.0, low: 2, high: 7 },
  alto: { size: 1.1, low: 4, high: 9 },
  soprano: { size: 1.2, low: 6, high: 11 },
}

// ──────────────── the mapping ────────────────

export function voiceFor(t: Traits): { spec: VoiceSpec; why: Why[] } {
  const why: Why[] = []
  const get = (k: string) => (t[k] ?? '').trim()

  // Mouth → vowel
  const mouth = get('Mouth')
  const vowel = MOUTH_VOWEL[mouth.toLowerCase()] ?? ((hash('mouth:' + mouth) % 5) as Vowel)
  if (mouth) why.push({ trait: 'Mouth', value: mouth, effect: `sings “${VOWELS[vowel].toLowerCase()}”` })

  // Body → voice type (register + formant size)
  const body = get('Body')
  const voiceType = voiceTypeOf(body)
  const shape = TYPE_SHAPE[voiceType]
  if (body) why.push({ trait: 'Body', value: body, effect: `${voiceType} voice` })

  // Eyes → timbre and vibrato
  const eyes = get('Eyes')
  let bright = lerp(0.35, 0.75, unit('eyes:' + eyes))
  let vibRate = lerp(4.6, 5.8, unit('eyesv:' + eyes))
  let vibDepth = lerp(10, 22, unit('eyesd:' + eyes))
  let breath = 0.05
  let eyesEffect = 'warm, steady tone'
  if (has(eyes, 'laser', 'visor', 'glass', 'vr', 'plasma', 'viper')) {
    bright = lerp(0.8, 0.98, unit('eyes:' + eyes)); vibRate = lerp(6.2, 7.4, unit('eyesv:' + eyes)); vibDepth = 14; eyesEffect = 'bright, buzzy edge'
  } else if (has(eyes, 'cry', 'tear', 'sad', 'tired', 'dead', 'worried')) {
    bright = lerp(0.15, 0.32, unit('eyes:' + eyes)); vibRate = lerp(3.8, 4.6, unit('eyesv:' + eyes)); vibDepth = lerp(26, 38, unit('eyesd:' + eyes)); breath = 0.16; eyesEffect = 'soft, breathy, trembling'
  } else if (has(eyes, 'happy', 'heart', 'smirk', 'xd', 'frog')) {
    bright = lerp(0.6, 0.8, unit('eyes:' + eyes)); vibRate = lerp(5.8, 6.6, unit('eyesv:' + eyes)); vibDepth = 18; eyesEffect = 'sunny, bouncy tone'
  } else if (has(eyes, 'angry', 'thug', 'mog', 'retard', 'side')) {
    bright = lerp(0.55, 0.8, unit('eyes:' + eyes)); vibRate = 5.2; vibDepth = 8; breath = 0.1; eyesEffect = 'tight, gritty tone'
  }
  if (eyes) why.push({ trait: 'Eyes', value: eyes, effect: eyesEffect })

  // Head → envelope
  const head = get('Head')
  let attack = lerp(0.04, 0.12, unit('head:' + head))
  let release = lerp(0.25, 0.5, unit('headr:' + head))
  let headEffect = 'medium attack'
  if (has(head, 'crown', 'wizard', 'spartan', 'russian', 'mega', 'king', 'helmet')) { attack = 0.2; release = 0.85; headEffect = 'slow, majestic swell' }
  else if (has(head, 'beanie', 'durag', 'headband', 'hair', 'wig', 'bob')) { attack = 0.11; release = 0.55; headEffect = 'soft, rounded onset' }
  else if (has(head, 'cap', 'hat')) { attack = 0.05; release = 0.32; headEffect = 'quick, clear onset' }
  else if (has(head, 'nose', 'plumber', 'robber')) { attack = 0.025; release = 0.2; headEffect = 'short and punchy' }
  if (head) why.push({ trait: 'Head', value: head, effect: headEffect })

  // Accessory → effect
  const acc = get('Accessory')
  const fx: Fx = ACCESSORY_FX[acc.toLowerCase()] ?? 'none'
  const FX_TEXT: Record<Fx, string> = { none: '', wobble: 'a ribbiting wobble', grit: 'a gritty edge', shimmer: 'a bell-like shimmer', echo: 'a flickering echo', smoke: 'a smoky rasp', sub: 'a sub-octave underneath' }
  if (acc && fx !== 'none') why.push({ trait: 'Accessory', value: acc, effect: FX_TEXT[fx] })
  if (fx === 'smoke') { breath = Math.max(breath, 0.22); bright = Math.min(bright, 0.4) }

  // Skin → formant brightness nudge
  const skin = get('Skin')
  const skinNudge: Record<string, number> = { red: 0.12, yellow: 0.08, pink: 0.02, origin: 0, white: 0.06, black: -0.14, grey: -0.08, blue: -0.05, green: -0.02, metal: 0.1 }
  bright = Math.min(1, Math.max(0, bright + (skinNudge[skin.toLowerCase()] ?? 0)))
  if (skin && skin.toLowerCase() !== 'origin') why.push({ trait: 'Skin', value: skin, effect: (skinNudge[skin.toLowerCase()] ?? 0) >= 0 ? 'a little brighter' : 'a little darker' })

  // Tier → richness
  const tier = get('Tier')
  const unison = TIER_UNISON[tier.toLowerCase()] ?? 1
  if (tier) why.push({ trait: 'Tier', value: tier, effect: unison === 1 ? 'a single clear voice' : `${unison} voices in unison` })

  // Side + Background → place in the room
  const side = get('Side')
  const bg = get('Background')
  const pan = Math.max(-0.8, Math.min(0.8, (side.toLowerCase() === 'left' ? -0.35 : side.toLowerCase() === 'right' ? 0.35 : 0) + (unit('bg:' + bg) - 0.5) * 0.4))
  if (side) why.push({ trait: 'Side', value: side, effect: side.toLowerCase() === 'left' ? 'stands left of centre' : 'stands right of centre' })

  // Aura → how much room it sings in
  const aura = get('Aura')
  let space = lerp(0.25, 0.5, unit('aura:' + aura))
  if (has(aura, 'cool', 'wind', 'smoke', 'mist', 'clean', 'scent')) space = lerp(0.6, 0.85, unit('aura:' + aura))
  else if (has(aura, 'fire', 'burning', 'fiery', 'electric')) { space = 0.18; bright = Math.min(1, bright + 0.08) }
  if (aura) why.push({ trait: 'Aura', value: aura, effect: space > 0.55 ? 'sings in a big airy room' : space < 0.22 ? 'sings close and hot' : 'a medium room' })

  // Skull / Radioactive → hollow source
  const hollow = get('Base').toLowerCase() === 'skull' || get('Form').toLowerCase() === 'skull' || get('Base').toLowerCase() === 'radioactive'
  if (hollow) why.push({ trait: get('Base').toLowerCase() === 'radioactive' ? 'Base' : 'Form', value: get('Base').toLowerCase() === 'radioactive' ? 'Radioactive' : 'Skull', effect: 'a hollow, ghostly source' })

  const bare = get('Naked').toLowerCase() === 'yes'
  if (bare) why.push({ trait: 'Naked', value: 'Yes', effect: 'sings a cappella, no room' })

  const spec: VoiceSpec = {
    vowel,
    voiceType,
    size: shape.size,
    low: shape.low,
    high: shape.high,
    bright,
    vibRate,
    vibDepth,
    breath,
    attack,
    release,
    fx,
    unison,
    detune: 5 + unison * 2.5,
    gain: 0.85 + (unison - 1) * 0.05,
    pan,
    space: bare ? 0 : space,
    hollow,
    bare,
  }
  return { spec, why }
}

// ──────────────── phrases ────────────────

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/** A Chog's signature phrase: its own rhythm and tune inside its home range. Low voices sing sparsely, high ones busy. */
export function phraseFor(id: number, spec: VoiceSpec, steps = 16): { step: number; pitch: number }[] {
  const r = rng(hash(`phrase:${id}`))
  const density = spec.voiceType === 'bass' ? 3 : spec.voiceType === 'tenor' ? 4 : spec.voiceType === 'alto' ? 5 : 6
  const out: { step: number; pitch: number }[] = []
  const used = new Set<number>()
  let pitch = spec.low + Math.floor(r() * (spec.high - spec.low + 1))
  const anchors = [0, 4, 8, 12]
  while (out.length < density) {
    const step = out.length === 0 ? anchors[Math.floor(r() * 4)] : Math.floor(r() * steps)
    if (used.has(step)) continue
    used.add(step)
    const move = Math.floor(r() * 5) - 2
    pitch = Math.min(spec.high, Math.max(spec.low, pitch + move))
    out.push({ step, pitch })
  }
  return out.sort((a, b) => a.step - b.step)
}
