import type { CSSProperties } from 'react'
import { useTranslation } from '../../i18n'
import type { TwdRateState } from '../../hooks/useTwdRate'
import { formatRate, formatTwdApprox } from '../../utils/twdFx'

/** 「≈ NT$ 1,234」小字；顯示幣別是台幣、匯率還沒好或抓不到時什麼都不畫。 */
export function TwdApprox({ amount, fx, style, className }: { amount: number; fx: TwdRateState; style?: CSSProperties; className?: string }) {
  const { locale } = useTranslation()
  if (fx.status === 'hidden' || fx.status === 'loading' || fx.status === 'error') return null
  const text = formatTwdApprox(amount, fx.rate, locale)
  if (!text) return null
  return <span data-testid="twd-approx" className={className ?? 'text-content-faint'} style={{ fontSize: '0.85em', fontWeight: 500, whiteSpace: 'nowrap', ...style }}>{text}</span>
}

/** 頁面上一處的匯率來源與時間小字（含離線／抓不到的說明）。 */
export function TwdRateNote({ fx, style, className }: { fx: TwdRateState; style?: CSSProperties; className?: string }) {
  const { t } = useTranslation()
  if (fx.status === 'hidden' || fx.status === 'loading') return null
  let text: string
  if (fx.status === 'error' || fx.rate == null) text = t('twdBudget.unavailable')
  else text = t(fx.status === 'offline' ? 'twdBudget.offlineNote' : 'twdBudget.rateNote', { base: fx.base, rate: formatRate(fx.rate), date: fx.date })
  return <div data-testid="twd-rate-note" className={className ?? 'text-content-faint'} style={{ fontSize: 12, textAlign: 'center', ...style }}>{text}</div>
}
