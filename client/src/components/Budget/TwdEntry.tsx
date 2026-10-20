import { useEffect, useRef, useState } from 'react'
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

  const rate = (fx.status === 'live' || fx.status === 'offline') ? fx.rate : null

  const fill = (clean: string, r: number) => {
    const n = Number.parseFloat(clean)
    if (!Number.isFinite(n)) { onFill(''); return }
    const v = fromTwd(n, r, currencyDecimals(currency))
    if (!Number.isNaN(v)) onFill(amountToInputString(v, currency))
  }

  // 已輸入台幣後才換幣別：用新幣別的匯率重算總額，不讓舊幣別的數字留在新幣別底下。
  const filledWith = useRef<{ currency: string; rate: number } | null>(null)
  useEffect(() => {
    if (rate == null || !twd) return
    const prev = filledWith.current
    if (prev && prev.currency === currency && prev.rate === rate) return
    filledWith.current = { currency, rate }
    fill(twd, rate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, rate])

  if (rate == null) return null

  // 台幣的小數點是「.」、逗號是千分位：「1,000」是一千，不是 1.000。
  const change = (raw: string) => {
    const clean = raw.replace(/,/g, '').replace(/[^0-9.]/g, '')
    setTwd(clean)
    filledWith.current = { currency, rate }
    fill(clean, rate)
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
