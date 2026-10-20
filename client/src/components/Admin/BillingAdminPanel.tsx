import { useTranslation } from '../../i18n'
import { useBillingAdmin, type PromoDraft } from './useBillingAdmin'

const ERROR_KEYS: Record<string, string> = {
  load: 'twBilling.adminErrorLoad',
  save: 'twBilling.adminErrorSave',
  promoExists: 'twBilling.adminErrorPromoExists',
  promoInvalid: 'twBilling.adminErrorPromoInvalid',
  userNotFound: 'twBilling.adminErrorUserNotFound',
}

const input = 'rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-content'
const button = 'rounded-lg px-3 py-2 text-sm font-semibold bg-accent text-accent-text cursor-pointer'
const ghost = 'rounded-lg px-3 py-1 text-xs border border-edge text-content cursor-pointer'

/**
 * 管理員後台「收費」分頁（ENSCON 旅程按趟收費）。
 * 優惠碼：折抵 1–100%（100%＝免費開團，不經過 Recur）、使用次數上限、到期日、停用／啟用。
 * 免費主揪：指定的帳號不用付款就能開新團。團員加入一律不收錢，這裡不用設。
 */
export default function BillingAdminPanel() {
  const { t } = useTranslation()
  const b = useBillingAdmin()
  const set = (k: keyof PromoDraft) => (e: { target: { value: string } }) => b.setDraft({ ...b.draft, [k]: e.target.value })

  return (
    <div className="space-y-6 text-content">
      {b.error && <p role="alert" className="text-sm">{t(ERROR_KEYS[b.error] ?? 'twBilling.adminErrorSave')}</p>}

      <section className="rounded-2xl border border-edge bg-surface-card p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t('twBilling.adminPromoTitle')}</h2>
          <p className="text-xs text-content-secondary mt-1">{t('twBilling.adminPromoHint')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <input aria-label={t('twBilling.adminPromoCode')} placeholder={t('twBilling.adminPromoCode')} className={input} value={b.draft.code} onChange={set('code')} />
          <input aria-label={t('twBilling.adminPromoPercent')} type="number" min={1} max={100} className={input} value={b.draft.percentOff} onChange={set('percentOff')} />
          <input aria-label={t('twBilling.adminPromoMaxUses')} placeholder={t('twBilling.adminPromoMaxUses')} type="number" min={1} className={input} value={b.draft.maxUses} onChange={set('maxUses')} />
          <input aria-label={t('twBilling.adminPromoExpires')} type="date" className={input} value={b.draft.expiresOn} onChange={set('expiresOn')} />
          <input aria-label={t('twBilling.adminNote')} placeholder={t('twBilling.adminNote')} className={input} value={b.draft.note} onChange={set('note')} />
        </div>
        <button type="button" className={button} onClick={b.createPromo} disabled={!b.draft.code.trim()}>{t('twBilling.adminPromoCreate')}</button>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-content-secondary">
            <tr>
              <th className="py-1">{t('twBilling.adminPromoCode')}</th>
              <th>{t('twBilling.adminPromoPercent')}</th>
              <th>{t('twBilling.adminPromoUsed')}</th>
              <th>{t('twBilling.adminPromoExpires')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {b.promos.map((p) => (
              <tr key={p.id} className="border-t border-edge">
                <td className="py-2 font-mono">{p.code}{p.note ? <span className="block text-xs text-content-secondary">{p.note}</span> : null}</td>
                <td>{p.percent_off}%</td>
                <td>{p.used_count}{p.max_uses !== null ? ` / ${p.max_uses}` : ''}</td>
                <td>{p.expires_at ? p.expires_at.slice(0, 10) : t('twBilling.adminNever')}</td>
                <td className="text-right">
                  <button type="button" className={ghost} onClick={() => b.togglePromo(p)}>
                    {p.active ? t('twBilling.adminDisable') : t('twBilling.adminEnable')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-edge bg-surface-card p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t('twBilling.adminFreeTitle')}</h2>
          <p className="text-xs text-content-secondary mt-1">{t('twBilling.adminFreeHint')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input aria-label={t('twBilling.adminFreeLogin')} placeholder={t('twBilling.adminFreeLogin')} className={input} value={b.login} onChange={(e) => b.setLogin(e.target.value)} />
          <input aria-label={t('twBilling.adminNote')} placeholder={t('twBilling.adminNote')} className={input} value={b.organizerNote} onChange={(e) => b.setOrganizerNote(e.target.value)} />
          <button type="button" className={button} onClick={b.addOrganizer} disabled={!b.login.trim()}>{t('twBilling.adminFreeAdd')}</button>
        </div>
        <ul className="text-sm divide-y divide-edge">
          {b.organizers.map((o) => (
            <li key={o.user_id} className="flex items-center justify-between py-2">
              <span>
                {o.username} <span className="text-xs text-content-secondary">{o.email}</span>
                {o.note ? <span className="block text-xs text-content-secondary">{o.note}</span> : null}
              </span>
              <button type="button" className={ghost} onClick={() => b.removeOrganizer(o.user_id)}>{t('twBilling.adminRemove')}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
