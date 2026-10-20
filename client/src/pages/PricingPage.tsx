import type { ReactNode } from 'react'
import { Check, Users, CalendarClock, Link2, ShieldCheck } from 'lucide-react'
import { useTranslation } from '../i18n'
import { usePricing } from './pricing/usePricing'

/**
 * /pricing — ENSCON 旅程按趟收費（未登入也看得到）。
 * 一頁講完：一趟多少錢、包含什麼、幾人、多久有效、退款規則、條款與隱私連結、購買鈕。
 * 收費沒開（金鑰沒設）時按鈕顯示「即將開放」，其他內容照樣看得到。
 */
export default function PricingPage() {
  const { t } = useTranslation()
  const { plan, loadFailed, enabled, isAuthenticated, consent, setConsent, busy, error, canBuy, buy, canceled } = usePricing()

  const price = plan?.price_twd ?? 299
  const buttonLabel = !enabled
    ? t('twBilling.comingSoon')
    : !isAuthenticated
      ? t('twBilling.loginToBuy')
      : busy
        ? t('twBilling.redirecting')
        : t('twBilling.buy', { price })
  const buttonActive = enabled && (!isAuthenticated || canBuy)

  return (
    <div className="min-h-screen bg-surface text-content flex justify-center px-4 py-10">
      <main className="w-full max-w-md flex flex-col gap-5">
        <header className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('twBilling.title')}</h1>
          <p className="text-sm text-content-secondary">{t('twBilling.subtitle')}</p>
        </header>

        {canceled && (
          <p role="status" className="text-sm rounded-xl border border-edge bg-surface-card px-4 py-3">{t('twBilling.canceled')}</p>
        )}

        <section className="rounded-2xl border border-edge bg-surface-card px-5 py-6">
          <div className="flex items-baseline justify-center gap-2 mb-5">
            <span className="text-4xl font-bold">{t('twBilling.price', { price })}</span>
            <span className="text-sm text-content-secondary">{t('twBilling.perTrip')}</span>
          </div>
          <h2 className="text-sm font-semibold mb-3">{t('twBilling.includesTitle')}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <Item icon={<Users size={16} />}>{t('twBilling.includeSeats', { seats: plan?.seats ?? 10 })}</Item>
            <Item icon={<CalendarClock size={16} />}>{t('twBilling.includeValidity', { days: plan?.days_after_return ?? 30 })}</Item>
            <Item icon={<Link2 size={16} />}>{t('twBilling.includeInvite')}</Item>
            <Item icon={<Check size={16} />}>{t('twBilling.includeFeatures')}</Item>
          </ul>
        </section>

        <section id="refund" className="rounded-2xl border border-edge bg-surface-card px-5 py-5">
          <h2 className="text-sm font-semibold mb-3">{t('twBilling.refundTitle')}</h2>
          <ul className="flex flex-col gap-2 text-sm text-content-secondary list-disc pl-5">
            <li>{t('twBilling.refundRule1')}</li>
            <li>{t('twBilling.refundRule2')}</li>
            <li>{t('twBilling.refundRule3')}</li>
          </ul>
          <p className="text-sm text-content-secondary mt-3">{t('twBilling.refundHow')}</p>
        </section>

        <section className="flex flex-col gap-3">
          <p className="text-sm rounded-xl border border-edge bg-surface-card px-4 py-3">{t('twBilling.withdrawalNotice')}</p>
          {enabled && isAuthenticated && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>{t('twBilling.consentLabel')}</span>
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-content">
              {error === 'consentOutdated' ? t('twBilling.errorConsentOutdated') : t('twBilling.errorGeneric')}
            </p>
          )}
          {loadFailed && <p role="alert" className="text-sm text-content">{t('twBilling.errorGeneric')}</p>}
          <button
            type="button"
            onClick={buy}
            disabled={!buttonActive}
            className={`w-full rounded-xl px-4 py-3 font-semibold ${buttonActive ? 'bg-accent text-accent-text cursor-pointer' : 'bg-surface-hover text-content-secondary cursor-default'}`}
          >
            {buttonLabel}
          </button>
          {!enabled && <p className="text-xs text-content-secondary text-center">{t('twBilling.comingSoonHint')}</p>}
          <p className="text-xs text-content-secondary text-center flex items-center justify-center gap-1">
            <ShieldCheck size={14} />
            {t('twBilling.paymentBy')}
          </p>
        </section>

        <nav className="flex justify-center gap-4 text-xs text-content-secondary">
          <a className="underline" href={plan?.terms_url ?? '/legal/terms'}>{t('twBilling.legalTerms')}</a>
          <a className="underline" href={plan?.privacy_url ?? '/legal/privacy'}>{t('twBilling.legalPrivacy')}</a>
          <a className="underline" href="/legal/pdpa">{t('twBilling.legalPdpa')}</a>
          <a className="underline" href="#refund">{t('twBilling.refundTitle')}</a>
        </nav>
      </main>
    </div>
  )
}

function Item({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-accent mt-0.5">{icon}</span>
      <span>{children}</span>
    </li>
  )
}
