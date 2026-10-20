import { describe, it, expect } from 'vitest'
import { getOutfitAdvice, bandForTemp } from './outfitRules'

describe('outfitRules', () => {
  it('FE-UTIL-OUTFIT-001: 各溫度區間與邊界值', () => {
    expect(bandForTemp(10)).toBe('cold')
    expect(bandForTemp(11)).toBe('cool')
    expect(bandForTemp(16)).toBe('cool')
    expect(bandForTemp(17)).toBe('mild')
    expect(bandForTemp(22)).toBe('mild')
    expect(bandForTemp(23)).toBe('warm')
    expect(bandForTemp(27)).toBe('warm')
    expect(bandForTemp(28)).toBe('hot')
    expect(bandForTemp(-5)).toBe('cold')
  })

  it('FE-UTIL-OUTFIT-002: 華氏先換成攝氏（68°F = 20°C → mild）', () => {
    expect(getOutfitAdvice({ tempMax: 68, unit: 'fahrenheit' })?.band).toBe('mild')
    expect(getOutfitAdvice({ tempMax: 50, unit: 'fahrenheit' })?.band).toBe('cold')
  })

  it('FE-UTIL-OUTFIT-003: 降雨機率 >=50% 或降水量 >=1mm 提雨具，49% / 0.9mm 不提', () => {
    expect(getOutfitAdvice({ tempMax: 20, precipProbability: 50 })?.tagKeys).toContain('twOutfit.tag.rain')
    expect(getOutfitAdvice({ tempMax: 20, precipMm: 1 })?.tagKeys).toContain('twOutfit.tag.rain')
    expect(getOutfitAdvice({ tempMax: 20, precipProbability: 49, precipMm: 0.9 })?.tagKeys).not.toContain('twOutfit.tag.rain')
  })

  it('FE-UTIL-OUTFIT-004: 風速 >8 m/s（km/h 換算）才提防風', () => {
    expect(getOutfitAdvice({ tempMax: 20, windKmh: 30 })?.tagKeys).toContain('twOutfit.tag.wind')
    expect(getOutfitAdvice({ tempMax: 20, windKmh: 28.8 })?.tagKeys).not.toContain('twOutfit.tag.wind')
  })

  it('FE-UTIL-OUTFIT-005: 缺資料略過規則；沒有最高溫回傳 null；至少 1 個、最多 3 個標籤', () => {
    expect(getOutfitAdvice({ tempMax: undefined as unknown as number })).toBeNull()
    const plain = getOutfitAdvice({ tempMax: 20 })!
    expect(plain.sentenceKey).toBe('twOutfit.band.mild')
    expect(plain.tagKeys).toEqual(['twOutfit.tag.layers'])
    const busy = getOutfitAdvice({ tempMax: 12, tempMin: 0, precipProbability: 80, windKmh: 50, withKids: true })!
    expect(busy.tagKeys).toHaveLength(3)
  })

  it('FE-UTIL-OUTFIT-006: 日夜溫差大提醒；有小孩且偏冷才提；炎熱提防曬', () => {
    expect(getOutfitAdvice({ tempMax: 25, tempMin: 14 })?.tagKeys).toContain('twOutfit.tag.swing')
    expect(getOutfitAdvice({ tempMax: 12, withKids: true })?.tagKeys).toContain('twOutfit.tag.kids')
    expect(getOutfitAdvice({ tempMax: 25, withKids: true })?.tagKeys).not.toContain('twOutfit.tag.kids')
    expect(getOutfitAdvice({ tempMax: 31 })?.tagKeys).toContain('twOutfit.tag.sun')
  })
})
