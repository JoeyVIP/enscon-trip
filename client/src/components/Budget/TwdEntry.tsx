import { useState } from 'react'
import { useTranslation } from '../../i18n'
import { useTwdRate } from '../../hooks/useTwdRate'
import { amountToInputString, currencyDecimals } from '../../utils/formatters'
import { fromTwd } from '../../utils/twdFx'

/**
 * 「用台幣輸入」：輸入 NT$ 金額，依即時匯率換成表單目前的幣別填進總額欄。
 * 只是輸入輔助，表單裡存的仍是該幣別的金額；幣別是台幣、或匯率抓不到時整個不顯示。
 * 桌面 ExpenseModal 與手機 MCostSheet 共用。
 */
export function TwdEntry({ currency, onFill }: { currency: string; onFill: (amount: string) => void }) {
  const { t } = useTranslation()
  const fx = useTwdRate(currency)
  const [open, setOpen] = useState(false)
  const [twd, setTwd] = useState('')

  if ((fx.status !== 'live' && fx.status !== 'offline') || fx.rate == null) return null

  const change = (raw: string) => {
    const clean = raw.replace(',', '.').replace(/[^0-9.]/g, '')
    setTwd(clean)
    const n = Number.parseFloat(clean)
    if (!Number.isFinite(n)) { onFill(''); return }
    const v = fromTwd(n, fx.rate as number, currencyDecimals(currency))
    if (!Number.isNaN(v)) onFill(amountToInputString(v, currency))
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-pressed={open}
        className="text-content-muted border border-edge"
        style={{ padding: '3px 10px', borderRadius: 999, background: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        {t('twdBudget.useTwd')}
      </button>
      {open && (
        <span className="bg-surface-input border border-edge text-content" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8, padding: '3px 8px', fontSize: 13 }}>
          NT$
          <input value={twd} onChange={e => change(e.target.value)} inputMode="decimal" aria-label={t('twdBudget.useTwd')}
            placeholder={t('twdBudget.twdInputPlaceholder')} className="text-content"
            style={{ border: 0, background: 'none', outline: 'none', width: 120, fontFamily: 'inherit', fontSize: 13 }} />
        </span>
      )}
    </div>
  )
}
