import { describe, it, expect } from 'vitest'
import { formatRate, formatTwdApprox, fromTwd, needsTwd, parseTwdRate, toTwd } from './twdFx'

// 記帳換匯的換算函式（純函式，顯示層用）
describe('twdFx', () => {
  it('needsTwd：台幣與非法幣別不顯示換算', () => {
    expect(needsTwd('JPY')).toBe(true)
    expect(needsTwd('jpy')).toBe(true)
    expect(needsTwd('TWD')).toBe(false)
    expect(needsTwd('twd')).toBe(false)
    expect(needsTwd('')).toBe(false)
    expect(needsTwd(null)).toBe(false)
  })

  it('toTwd：四捨五入到整數元，負數對稱', () => {
    expect(toTwd(1000, 0.2084)).toBe(208)
    expect(toTwd(1003, 0.2084)).toBe(209) // 209.0252 → 209
    expect(toTwd(2.5, 1)).toBe(3)
    expect(toTwd(-2.5, 1)).toBe(-3)
    expect(toTwd(0, 0.2)).toBe(0)
  })

  it('toTwd：匯率或金額不合法回傳 NaN', () => {
    expect(toTwd(100, 0)).toBeNaN()
    expect(toTwd(100, -1)).toBeNaN()
    expect(toTwd(Number.NaN, 0.2)).toBeNaN()
  })

  it('fromTwd：台幣換回行程貨幣，依小數位數四捨五入', () => {
    expect(fromTwd(208, 0.2084, 0)).toBe(998) // 998.08 → 998
    expect(fromTwd(100, 0.0315, 2)).toBe(3174.6) // USD 之類兩位小數
    expect(fromTwd(100, 0, 0)).toBeNaN()
  })

  it('formatTwdApprox：格式為「≈ NT$ 1,234」', () => {
    expect(formatTwdApprox(6000, 0.2, 'en')).toBe('≈ NT$ 1,200')
    expect(formatTwdApprox(-6000, 0.2, 'en')).toBe('≈ -NT$ 1,200')
    expect(formatTwdApprox(100, null)).toBeNull()
    expect(formatTwdApprox(100, 0)).toBeNull()
  })

  it('parseTwdRate：只取 TWD，格式不對回傳 null', () => {
    expect(parseTwdRate([{ date: '2026-10-19', quote: 'USD', rate: 0.0065 }, { date: '2026-10-19', quote: 'TWD', rate: 0.2084 }]))
      .toEqual({ rate: 0.2084, date: '2026-10-19' })
    expect(parseTwdRate([{ quote: 'USD', rate: 1 }])).toBeNull()
    expect(parseTwdRate([{ quote: 'TWD', rate: 0 }])).toBeNull()
    expect(parseTwdRate({ rates: {} })).toBeNull()
    expect(parseTwdRate([])).toBeNull()
  })

  it('formatRate：四位有效數字', () => {
    expect(formatRate(0.20841234)).toBe('0.2084')
    expect(formatRate(31.5678)).toBe('31.57')
  })
})
