import type { ReactNode } from 'react'
import { CheckCircle2, Copy, Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from '../i18n'
import { useBillingSuccess } from './billing/useBillingSuccess'

/**
 * /billing/success — 付款完成頁：團已開好、邀請連結、下一步，加上七日解除權的交付後告知（billing-plan §4-1 第 3 點）。
 */
export default function BillingSuccessPage() {
  const { t } = useTranslation()
  const { state, purchase, inviteUrl, copied, copyInvite, openTrip, backToPricing, slow } = useBillingSuccess()

  const card = 'w-full max-w-md rounded-2xl border border-edge bg-surface-card px-5 py-6 text-content flex flex-col gap-4'
  const secondaryBtn = 'rounded-xl px-4 py-3 font-semibold bg-surface-hover text-content cursor-pointer'
  const primaryBtn = 'rounded-xl px-4 py-3 font-semibold bg-accent text-accent-text cursor-pointer'

  let body: ReactNode
  if (state === 'loading' || state === 'pending') {
    body = (
      <>
        <div className="flex items-center gap-2">
          <Loader2 size={20} className="animate-spin text-accent" />
          <h1 className="text-lg font-bold">{t('twBilling.successPending')}</h1>
        </div>
        <p className="text-sm text-content-secondary">{slow ? t('twBilling.successSlow') : t('twBilling.successPendingHint')}</p>
      </>
    )
  } else if (state === 'fulfilled' || state === 'partially_refunded') {
    body = (
      <>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={22} className="text-accent" />
          <h1 className="text-lg font-bold">{t('twBilling.successTitle')}</h1>
        </div>
        {purchase?.trip_title && <p className="text-sm text-content-secondary">{purchase.trip_title}</p>}
        {state === 'partially_refunded' && <p className="text-sm">{t('twBilling.successPartiallyRefunded')}</p>}
        {inviteUrl ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{t('twBilling.successInviteLabel')}</p>
            <a className="text-sm break-all underline" href={inviteUrl}>{inviteUrl}</a>
            <button type="button" onClick={copyInvite} className={`${secondaryBtn} inline-flex items-center justify-center gap-2`}>
              <Copy size={16} />
              {copied ? t('twBilling.successCopied') : t('twBilling.successCopy')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-content-secondary">{t('twBilling.successNoInvite')}</p>
        )}
        {purchase?.trip_id && (
          <button type="button" onClick={openTrip} className={primaryBtn}>{t('twBilling.successOpenTrip')}</button>
        )}
        <div>
          <h2 className="text-sm font-semibold mb-2">{t('twBilling.successNextTitle')}</h2>
          <ol className="list-decimal pl-5 text-sm flex flex-col gap-1">
            <li>{t('twBilling.successNext1')}</li>
            <li>{t('twBilling.successNext2')}</li>
            <li>{t('twBilling.successNext3')}</li>
          </ol>
        </div>
        <p className="text-xs text-content-secondary">{t('twBilling.successWithdrawalAck')}</p>
      </>
    )
  } else {
    const message = state === 'failed'
      ? t('twBilling.successFailed')
      : state === 'refunded'
        ? t('twBilling.successRefunded')
        : t('twBilling.successNotFound')
    body = (
      <>
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-content-secondary" />
          <p className="text-sm">{message}</p>
        </div>
        <button type="button" onClick={backToPricing} className={secondaryBtn}>{t('twBilling.backToPricing')}</button>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex justify-center px-4 py-10">
      <main className={card}>{body}</main>
    </div>
  )
}
