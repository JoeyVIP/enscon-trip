/**
 * 記帳換匯：把顯示幣別的金額換算成新台幣（TWD）的純函式。
 * 只用在「顯示層」——儲存的金額仍是行程貨幣的整數 cents，這裡不碰計算邏輯。
 */

export const TWD = 'TWD'

/** 顯示幣別已經是台幣時，不需要再顯示換算。 */
export function needsTwd(currency: string | null | undefined): boolean {
  const c = (currency || '').toUpperCase()
  return /^[A-Z]{3}$/.test(c) && c !== TWD
}

/** 金額 × 匯率，新台幣不顯示小數，四捨五入（負數對稱，-0.5 → -1）。 */
export function toTwd(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return NaN
  const v = Math.round(Math.abs(amount) * rate)
  return amount < 0 ? -v : v
}

/** 台幣金額換回顯示（行程）幣別，結果依該幣別的小數位數四捨五入。 */
export function fromTwd(twd: number, rate: number, decimals: number): number {
  if (!Number.isFinite(twd) || !Number.isFinite(rate) || rate <= 0) return NaN
  const unit = 10 ** decimals
  return Math.round((twd / rate) * unit) / unit
}

/** 「≈ NT$ 1,234」；無法換算時回傳 null。 */
export function formatTwdApprox(amount: number, rate: number | null | undefined, locale?: string): string | null {
  if (rate == null) return null
  const v = toTwd(amount, rate)
  if (Number.isNaN(v)) return null
  let num: string
  try { num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(v)) } catch { num = String(Math.abs(v)) }
  return `≈ ${v < 0 ? '-' : ''}NT$ ${num}`
}

/** 從 frankfurter v2 回應挑出 TWD 的匯率與日期。格式不對回傳 null。 */
export function parseTwdRate(data: unknown): { rate: number; date: string } | null {
  if (!Array.isArray(data)) return null
  const row = data.find((r): r is { quote: string; rate: number; date?: string } => !!r && r.quote === TWD && typeof r.rate === 'number' && r.rate > 0 && Number.isFinite(r.rate))
  if (!row) return null
  return { rate: row.rate, date: typeof row.date === 'string' ? row.date : '' }
}

/** 匯率顯示用：保留四位有效數字（0.2084）。 */
export function formatRate(rate: number): string {
  return String(Number(rate.toPrecision(4)))
}
