import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { useSettingsStore } from '../../store/settingsStore'
import { fetchWeather } from '../../services/weatherQueue'
import { getOutfitAdvice } from '../../utils/outfitRules'

interface WeatherLike {
  temp?: number
  temp_max?: number
  temp_min?: number
  precipitation_sum?: number
  precipitation_probability_max?: number
  wind_max?: number
  error?: string
}

/** 天氣旁的一行小字「今天穿什麼」；沒有天氣資料就整個不畫。 */
export function OutfitHint({ weather, className, style }: { weather: WeatherLike | null | undefined; className?: string; style?: React.CSSProperties }) {
  const { t } = useTranslation()
  if (!weather || weather.error) return null
  // API 一律回傳攝氏；沒有高低溫時退回當下平均溫
  const tempMax = weather.temp_max ?? weather.temp
  const advice = getOutfitAdvice({
    tempMax: tempMax as number,
    tempMin: weather.temp_min,
    precipProbability: weather.precipitation_probability_max,
    precipMm: weather.precipitation_sum,
    windKmh: weather.wind_max,
    unit: 'celsius',
  })
  if (!advice) return null
  const tags = advice.tagKeys.map(k => t(k)).join('・')
  return (
    <div data-testid="outfit-hint" className={className} style={style}>
      {t(advice.sentenceKey)}
      {tags ? ` · ${tags}` : ''}
    </div>
  )
}

/** 桌面版：沿用天氣元件的 sessionStorage 快取（沒有才向既有 /weather 取），再畫穿衣小字。 */
export function DayOutfitLine({ lat, lng, date }: { lat: number | null; lng: number | null; date: string }) {
  const language = useSettingsStore(s => s.settings.language) || 'en'
  const [weather, setWeather] = useState<WeatherLike | null>(null)
  useEffect(() => {
    if (!lat || !lng || !date) { setWeather(null); return }
    let cancelled = false
    const key = `weather_${Math.round(lat * 100) / 100}_${Math.round(lng * 100) / 100}_${date}_${language}`
    try {
      const raw = sessionStorage.getItem(key)
      const cached = raw ? JSON.parse(raw) : null
      const data = cached?.data ?? cached
      if (data && data.temp !== undefined) { setWeather(data); return }
    } catch { /* 快取壞掉就重取 */ }
    fetchWeather(lat, lng, date, language)
      .then(d => { if (!cancelled && !d.error && d.temp !== undefined) setWeather(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [lat, lng, date, language])
  return (
    <OutfitHint
      weather={weather}
      style={{ fontSize: 'calc(10.5px * var(--fs-scale-caption, 1))', color: 'var(--text-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    />
  )
}
