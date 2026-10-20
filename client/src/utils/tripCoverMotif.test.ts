// FE-TW-COVER-001 onwards
import { describe, it, expect } from 'vitest'
import { seededRandom, tripCoverMotif } from './tripCoverMotif'

describe('tripCoverMotif', () => {
  it('FE-TW-COVER-001: island and beach trips get the sea', () => {
    expect(tripCoverMotif('🌺 沖繩跨年親子行 2026→2027')).toBe('sea')
    expect(tripCoverMotif('Bali honeymoon')).toBe('sea')
    expect(tripCoverMotif('墾丁三天兩夜')).toBe('sea')
  })

  it('FE-TW-COVER-002: mountains and snow get ridges, including 北海道 despite its 海', () => {
    expect(tripCoverMotif('北海道雪祭')).toBe('mountain')
    expect(tripCoverMotif('Swiss Alps')).toBe('mountain')
    expect(tripCoverMotif('合歡山看星星')).toBe('mountain')
  })

  it('FE-TW-COVER-003: big cities get a skyline, including 上海 and 廣島', () => {
    expect(tripCoverMotif('東京 9 天')).toBe('city')
    expect(tripCoverMotif('Seoul weekend')).toBe('city')
    expect(tripCoverMotif('上海出差順便玩')).toBe('city')
    expect(tripCoverMotif('廣島・宮島')).toBe('city')
  })

  it('FE-TW-COVER-004: anything else falls back to the travel scene', () => {
    expect(tripCoverMotif('ENSCON 員工旅遊')).toBe('travel')
    expect(tripCoverMotif('')).toBe('travel')
    expect(tripCoverMotif(null, null)).toBe('travel')
    // English words are matched whole, so "Helsinki" is not a ski trip.
    expect(tripCoverMotif('Helsinki')).toBe('travel')
  })

  it('FE-TW-COVER-005: the description counts when the title says nothing', () => {
    expect(tripCoverMotif('Family trip', 'a week on the beach')).toBe('sea')
  })

  it('FE-TW-COVER-006: the seeded sequence is stable per seed and differs between seeds', () => {
    const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43)
    const seqA = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seqA)
    expect([c(), c(), c()]).not.toEqual(seqA)
    seqA.forEach(n => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(1) })
  })
})
