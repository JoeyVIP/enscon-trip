import { useParams } from 'react-router'
import { useTranslation } from '../i18n'

const TITLE_KEYS: Record<string, string> = {
  terms: 'twBilling.legalTerms',
  privacy: 'twBilling.legalPrivacy',
  pdpa: 'twBilling.legalPdpa',
}

/**
 * /legal/:doc — 服務條款、隱私權政策、個資告知的佔位頁。
 * 草稿在 joey-assistant docs/legal/（v0.1，待 Atlas 審），正式網址還沒定；定了之後設
 * TRIP_BILLING_TERMS_URL／TRIP_BILLING_PRIVACY_URL，收費頁就會改連過去。
 */
export default function LegalPlaceholderPage() {
  const { t } = useTranslation()
  const { doc = '' } = useParams<{ doc: string }>()
  const titleKey = TITLE_KEYS[doc] ?? TITLE_KEYS.terms

  return (
    <div className="min-h-screen bg-surface flex justify-center px-4 py-10">
      <main className="w-full max-w-md rounded-2xl border border-edge bg-surface-card px-5 py-6 text-content flex flex-col gap-3">
        <h1 className="text-lg font-bold">{t(titleKey)}</h1>
        <p className="text-sm text-content-secondary">{t('twBilling.legalPlaceholderBody')}</p>
        <a className="text-sm underline" href="/pricing">{t('twBilling.backToPricing')}</a>
      </main>
    </div>
  )
}
