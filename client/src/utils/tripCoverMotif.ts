/**
 * Picks the illustration a trip without a cover photo gets on the dashboard,
 * from its title (and description, if any). Pure and deterministic: the same
 * trip always draws the same scene, so the card doesn't reshuffle on reload.
 *
 *   sea      — islands, beaches, coastal trips (沖繩, Bali, 墾丁 …)
 *   mountain — mountains, snow, hiking (北海道, Alps, 合歡山 …)
 *   city     — big-city trips (東京, Seoul, Paris …)
 *   travel   — everything else: rolling hills and a dotted route
 */
export type TripCoverMotif = 'sea' | 'mountain' | 'city' | 'travel'

// Place names whose own characters would trip a broader rule below:
// 北海道 has 海, 上海 has 海, 廣島 has 島.
const NAMED: ReadonlyArray<[TripCoverMotif, RegExp]> = [
  ['mountain', /北海道|hokkaido/i],
  ['city', /上海|shanghai|廣島|广岛|広島|hiroshima/i],
]

// Checked in this order, so a beach trip that also names its city stays a beach trip.
const RULES: ReadonlyArray<[TripCoverMotif, RegExp]> = [
  ...NAMED,
  ['sea', /沖繩|沖绳|沖縄|海|島|岛|灘|滩|湾|灣|浜|ビーチ|바다|해변|섬|okinawa|beach|island|coast|bali|hawaii|phuket|cebu|boracay|guam|saipan|palau|maldives|ishigaki|miyako|峇里|巴厘|夏威夷|墾丁|垦丁|澎湖|綠島|蘭嶼|普吉|宿霧|長灘|關島|塞班|帛琉|馬爾地夫|石垣|宮古|濟州|济州|jeju/i],
  ['mountain', /山|岳|雪|峰|合歡|阿里|玉山|富士|alps|alpine|mountain|\bski|snow|hike|hiking|swiss|switzerland|nepal|瑞士|尼泊爾|滑雪|登山|健行|立山|上高地|白川/i],
  ['city', /東京|东京|首爾|首尔|大阪|京都|名古屋|福岡|曼谷|香港|澳門|新加坡|紐約|纽约|巴黎|倫敦|伦敦|上海|北京|台北|臺北|高雄|台中|臺中|釜山|tokyo|seoul|osaka|kyoto|bangkok|hong kong|singapore|new york|\bnyc\b|paris|london|shanghai|taipei|busan|\bcity\b|城市|都市/i],
]

export function tripCoverMotif(title?: string | null, description?: string | null): TripCoverMotif {
  const text = `${title ?? ''} ${description ?? ''}`
  for (const [motif, re] of RULES) if (re.test(text)) return motif
  return 'travel'
}

/**
 * Seeded PRNG (mulberry32). A trip id gives the same sequence every render, so
 * the wave phase / skyline heights / sun position are stable per trip but differ
 * between trips that share a motif.
 */
export function seededRandom(seed: number): () => number {
  let a = (Math.trunc(seed) ^ 0x9e3779b9) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
