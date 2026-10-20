/**
 * 天氣穿衣規則（純函式、純前端，不呼叫任何 API）。
 * 輸入當天預報數值，輸出「一句話」與 1～3 個標籤的 i18n key，由顯示層翻譯。
 */

// ── 門檻（皆為攝氏，取整數後比較）──
// 依據：一般日常穿衣指數與台灣氣象署穿衣建議的常見分級。
export const TEMP_COLD_MAX = 10   // ≤10℃：厚外套保暖
export const TEMP_COOL_MAX = 16   // 11–16℃：外套＋長袖
export const TEMP_MILD_MAX = 22   // 17–22℃：薄長袖＋輕外套
export const TEMP_WARM_MAX = 27   // 23–27℃：短袖或薄長袖；≥28℃ 視為炎熱
export const RAIN_PROB_MIN = 50   // 降雨機率 ≥50% 提雨具（%）
export const RAIN_MM_MIN = 1      // 降水量 ≥1mm 提雨具
export const WIND_MS_MIN = 8      // 風速高於 8 m/s（約 5 級風、行走明顯受風）提防風
export const DAY_SWING_MIN = 10   // 日夜溫差 ≥10℃ 提早晚加衣
const KMH_PER_MS = 3.6            // 伺服器風速為 km/h（Open-Meteo 預設）

export type TempUnit = 'celsius' | 'fahrenheit'
export type OutfitBand = 'cold' | 'cool' | 'mild' | 'warm' | 'hot'

export interface OutfitInput {
  tempMax: number
  tempMin?: number | null
  /** 降雨機率（%），沒有就略過 */
  precipProbability?: number | null
  /** 降水量（mm），沒有就略過 */
  precipMm?: number | null
  /** 風速，單位 km/h（伺服器原樣），沒有就略過 */
  windKmh?: number | null
  /** 溫度單位，預設攝氏；華氏會先換成攝氏再判斷 */
  unit?: TempUnit
  /** 同行有小孩；無法判斷時不傳 */
  withKids?: boolean
}

export interface OutfitAdvice {
  band: OutfitBand
  /** 一句話的 i18n key（twOutfit.*） */
  sentenceKey: string
  /** 1～3 個標籤的 i18n key */
  tagKeys: string[]
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const toC = (v: number, unit: TempUnit) => (unit === 'fahrenheit' ? (v - 32) * 5 / 9 : v)

export function bandForTemp(celsius: number): OutfitBand {
  const c = Math.round(celsius)
  if (c <= TEMP_COLD_MAX) return 'cold'
  if (c <= TEMP_COOL_MAX) return 'cool'
  if (c <= TEMP_MILD_MAX) return 'mild'
  if (c <= TEMP_WARM_MAX) return 'warm'
  return 'hot'
}

// 沒有其他提醒時，至少給一個依溫度的標籤
const BAND_FALLBACK_TAG: Record<OutfitBand, string> = {
  cold: 'twOutfit.tag.warmLayer',
  cool: 'twOutfit.tag.layers',
  mild: 'twOutfit.tag.layers',
  warm: 'twOutfit.tag.breathable',
  hot: 'twOutfit.tag.sun',
}

/** 資料不足（沒有最高溫）時回傳 null，顯示層就不畫。 */
export function getOutfitAdvice(input: OutfitInput): OutfitAdvice | null {
  if (!input || !isNum(input.tempMax)) return null
  const unit = input.unit ?? 'celsius'
  const maxC = toC(input.tempMax, unit)
  const minC = isNum(input.tempMin) ? toC(input.tempMin, unit) : null
  const band = bandForTemp(maxC)

  const extras: string[] = []
  const rainy = (isNum(input.precipProbability) && input.precipProbability >= RAIN_PROB_MIN)
    || (isNum(input.precipMm) && input.precipMm >= RAIN_MM_MIN)
  if (rainy) extras.push('twOutfit.tag.rain')
  if (isNum(input.windKmh) && input.windKmh / KMH_PER_MS > WIND_MS_MIN) extras.push('twOutfit.tag.wind')
  if (minC !== null && maxC - minC >= DAY_SWING_MIN && band !== 'hot') extras.push('twOutfit.tag.swing')
  if (input.withKids && (band === 'cold' || band === 'cool' || rainy)) extras.push('twOutfit.tag.kids')
  if (band === 'hot') extras.push('twOutfit.tag.sun')

  const tagKeys = [...new Set(extras)].slice(0, 3)
  if (tagKeys.length === 0) tagKeys.push(BAND_FALLBACK_TAG[band])
  return { band, sentenceKey: `twOutfit.band.${band}`, tagKeys }
}
