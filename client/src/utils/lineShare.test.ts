// FE-UTIL-LINESHARE-001 to FE-UTIL-LINESHARE-011
import {
  buildDayShareText, buildLineShareUrl, buildMapsLink, buildSharedTripUrl, buildTripShareText,
  isLineAppDevice, LINE_SHARE_MAX_URL_LENGTH,
} from './lineShare'

describe('lineShare', () => {
  it('FE-UTIL-LINESHARE-001: 手機分享網址 = 官方 line.me/R/share?text=，encodeURIComponent 編碼中文與換行', () => {
    const raw = '東京\nhttps://a.b/?x=1&y=2'
    const url = buildLineShareUrl(raw, true)
    expect(url).toBe('https://line.me/R/share?text=' + encodeURIComponent(raw))
    expect(url).not.toContain('\n')
    expect(new URL(url).searchParams.get('text')).toBe(raw)
  })

  it('FE-UTIL-LINESHARE-010: 桌面改用 LINE 網頁分享頁（URL scheme 不支援 PC）', () => {
    const raw = '東京\nhttps://a.b/?x=1&y=2'
    const url = buildLineShareUrl(raw, false)
    expect(url.startsWith('https://social-plugins.line.me/lineit/share?')).toBe(true)
    expect(new URL(url).searchParams.get('text')).toBe(raw)
  })

  it('FE-UTIL-LINESHARE-011: 手機／平板判斷（含 iPadOS 桌面模式）', () => {
    expect(isLineAppDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', 5)).toBe(true)
    expect(isLineAppDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36', 5)).toBe(true)
    expect(isLineAppDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5)).toBe(true)
    expect(isLineAppDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0', 0)).toBe(false)
    expect(isLineAppDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', 0)).toBe(false)
  })

  it('FE-UTIL-LINESHARE-002: 公開連結 = origin + /shared/ + token', () => {
    expect(buildSharedTripUrl('abc', 'https://trip.example.com')).toBe('https://trip.example.com/shared/abc')
  })

  it('FE-UTIL-LINESHARE-003: 行程文字含標題、日期區間與連結', () => {
    const text = buildTripShareText({ title: '示範行程', start_date: '2026-10-21', end_date: '2026-10-25' }, 'https://x/shared/t')
    expect(text).toBe('示範行程\n2026/10/21 – 2026/10/25\nhttps://x/shared/t')
  })

  it('FE-UTIL-LINESHARE-004: 沒有日期時只剩標題與連結', () => {
    expect(buildTripShareText({ title: 'Demo' }, 'https://x/shared/t')).toBe('Demo\nhttps://x/shared/t')
  })

  it('FE-UTIL-LINESHARE-005: 單日文字 = 日期（含星期）、標題、時間 站名、地圖連結', () => {
    const text = buildDayShareText({
      date: '2026-10-21', locale: 'en-US', title: 'Day one',
      stops: [
        { name: 'Alpha Cafe', time: '09:30:00', lat: 25.03, lng: 121.56 },
        { name: 'Beta Park', time: null, lat: 25.04, lng: 121.57 },
      ],
    })
    const lines = text.split('\n')
    expect(lines[0]).toMatch(/Wed/)
    expect(lines[1]).toBe('Day one')
    expect(lines[2]).toBe('09:30 Alpha Cafe')
    // 只取第一站座標，連結緊接在第一站下面
    expect(lines[3]).toBe('https://www.google.com/maps/search/?api=1&query=25.03,121.56')
    expect(lines[4]).toBe('Beta Park')
    expect(lines).toHaveLength(5)
  })

  it('FE-UTIL-LINESHARE-006: 第一站沒有座標就略過地圖連結', () => {
    expect(buildMapsLink(null, 121)).toBeNull()
    expect(buildMapsLink(NaN, 121)).toBeNull()
    const text = buildDayShareText({ date: '2026-10-21', locale: 'en-US', stops: [{ name: 'A', time: '08:00' }, { name: 'B', lat: 1, lng: 2 }] })
    expect(text).not.toContain('google.com/maps')
  })

  it('FE-UTIL-LINESHARE-007: 沒有站點時只有日期與標題', () => {
    const text = buildDayShareText({ date: '2026-10-21', locale: 'en-US', title: 'Free day', stops: [] })
    expect(text.split('\n')).toHaveLength(2)
    expect(text).toContain('Free day')
  })

  it('FE-UTIL-LINESHARE-008: 過長時截斷、加「…」並附行程公開連結，且網址不超過上限', () => {
    const stops = Array.from({ length: 80 }, (_, i) => ({ name: `示範景點名稱${i}`, time: '10:00', lat: 1, lng: 2 }))
    const tripUrl = 'https://trip.example.com/shared/tok'
    const text = buildDayShareText({ date: '2026-10-21', locale: 'en-US', title: 'Long', stops, tripUrl })
    expect(buildLineShareUrl(text, true).length).toBeLessThanOrEqual(LINE_SHARE_MAX_URL_LENGTH)
    expect(buildLineShareUrl(text, false).length).toBeLessThanOrEqual(LINE_SHARE_MAX_URL_LENGTH)
    const lines = text.split('\n')
    expect(lines[lines.length - 2]).toBe('…')
    expect(lines[lines.length - 1]).toBe(tripUrl)
    expect(text).toContain('示範景點名稱0')
    expect(text).not.toContain('示範景點名稱79')
  })

  it('FE-UTIL-LINESHARE-009: 過長但沒有公開連結時只加「…」', () => {
    const stops = Array.from({ length: 80 }, (_, i) => ({ name: `示範景點名稱${i}` }))
    const text = buildDayShareText({ date: '2026-10-21', locale: 'en-US', stops })
    expect(text.endsWith('…')).toBe(true)
    expect(buildLineShareUrl(text, true).length).toBeLessThanOrEqual(LINE_SHARE_MAX_URL_LENGTH)
    expect(buildLineShareUrl(text, false).length).toBeLessThanOrEqual(LINE_SHARE_MAX_URL_LENGTH)
  })
})
