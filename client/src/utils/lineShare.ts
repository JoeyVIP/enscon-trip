// 台灣人用 LINE 群組溝通：把行程／單日行程組成純文字，交給 LINE 的分享畫面。
// 全部是純前端字串處理，不引入任何外部 SDK。
//
// 隱私：只取「行程標題、日期、站名、時間、第一站座標」。
// 訂位代號、備註、住宿地址等一律不進分享文字。

/** LINE 分享網址（含編碼後的文字）過長時部分平台會開不起來，抓約 1800 字元為上限。 */
export const LINE_SHARE_MAX_URL_LENGTH = 1800

const LINE_SHARE_BASE = 'https://line.me/R/msg/text/?'

/** 組出 LINE 分享網址；文字一律 encodeURIComponent，換行與中文都安全。 */
export function buildLineShareUrl(text: string): string {
  return LINE_SHARE_BASE + encodeURIComponent(text)
}

/** 行程公開分享連結：與行程分享 modal 一致，用目前網站 origin + /shared/<token>。 */
export function buildSharedTripUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/shared/${token}`
}

const slashDate = (d: string) => d.replace(/-/g, '/')

/** 「分享行程到 LINE」的文字：標題＋日期區間＋公開連結。 */
export function buildTripShareText(trip: { title?: string | null; start_date?: string | null; end_date?: string | null }, shareUrl: string): string {
  const lines: string[] = []
  if (trip.title) lines.push(trip.title)
  const { start_date: s, end_date: e } = trip
  if (s && e && s !== e) lines.push(`${slashDate(s)} – ${slashDate(e)}`)
  else if (s || e) lines.push(slashDate((s || e) as string))
  lines.push(shareUrl)
  return lines.join('\n')
}

export interface LineShareStop {
  name?: string | null
  time?: string | null
  lat?: number | null
  lng?: number | null
}

/** Google Maps 搜尋連結；沒有座標（或不是有限數字）回傳 null。 */
export function buildMapsLink(lat?: number | null, lng?: number | null): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/** 日期含星期，例如「2026/10/21（週三）」，由 locale 決定語言。 */
export function formatShareDate(date: string | null | undefined, locale: string): string {
  if (!date) return ''
  try {
    const d = new Date(date + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return date
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' })
  } catch { return date }
}

/**
 * 「分享今天行程到 LINE」的文字：
 *   日期（含星期）／當天標題／每站「時間 站名」／第一站的 Google Maps 連結。
 * 編碼後網址超過上限時，從尾端砍站點並加「…」，再附行程公開連結（有的話）。
 */
export function buildDayShareText(opts: {
  date?: string | null
  locale: string
  title?: string | null
  stops: LineShareStop[]
  tripUrl?: string | null
  maxUrlLength?: number
}): string {
  const max = opts.maxUrlLength ?? LINE_SHARE_MAX_URL_LENGTH
  const head: string[] = []
  const dateText = formatShareDate(opts.date, opts.locale)
  if (dateText) head.push(dateText)
  if (opts.title) head.push(opts.title)
  const stopLines = opts.stops
    .filter(s => s.name)
    .map(s => (s.time ? `${String(s.time).slice(0, 5)} ${s.name}` : String(s.name)))
  // 第一站＝當天排序最前面的站；沒座標就略過地圖連結
  const mapLink = buildMapsLink(opts.stops[0]?.lat, opts.stops[0]?.lng)

  const fits = (lines: string[]) => buildLineShareUrl(lines.join('\n')).length <= max
  const full = [...head, ...stopLines, ...(mapLink ? [mapLink] : [])]
  if (fits(full)) return full.join('\n')

  // 過長：盡量保留站點，結尾「…」＋行程公開連結
  const tail = ['…', ...(opts.tripUrl ? [opts.tripUrl] : [])]
  const kept: string[] = []
  for (const line of stopLines) {
    if (!fits([...head, ...kept, line, ...tail])) break
    kept.push(line)
  }
  return [...head, ...kept, ...tail].join('\n')
}

/** 開啟 LINE 分享畫面（手機喚起 LINE app，桌面開網頁版）。 */
export function openLineShare(text: string): void {
  window.open(buildLineShareUrl(text), '_blank', 'noopener,noreferrer')
}
