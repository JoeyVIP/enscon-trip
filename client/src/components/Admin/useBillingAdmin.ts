import { useCallback, useEffect, useState } from 'react'
import type { BillingFreeOrganizer, BillingPromo } from '@trek/shared'
import { billingAdminApi } from '../../api/billing'

export interface PromoDraft {
  code: string
  percentOff: string
  maxUses: string
  expiresOn: string
  note: string
}

export const EMPTY_PROMO: PromoDraft = { code: '', percentOff: '100', maxUses: '', expiresOn: '', note: '' }

/** 管理員後台「收費」分頁：優惠碼與免費主揪的資料與動作。 */
export function useBillingAdmin() {
  const [promos, setPromos] = useState<BillingPromo[]>([])
  const [organizers, setOrganizers] = useState<BillingFreeOrganizer[]>([])
  const [draft, setDraft] = useState<PromoDraft>(EMPTY_PROMO)
  const [login, setLogin] = useState('')
  const [organizerNote, setOrganizerNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([billingAdminApi.listPromos(), billingAdminApi.listFreeOrganizers()])
      setPromos(p.promo_codes)
      setOrganizers(o.free_organizers)
    } catch {
      setError('load')
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const createPromo = async () => {
    setError(null)
    const percent = Number(draft.percentOff)
    try {
      await billingAdminApi.createPromo({
        code: draft.code.trim(),
        percent_off: percent,
        max_uses: draft.maxUses.trim() ? Number(draft.maxUses) : null,
        expires_on: draft.expiresOn || null,
        note: draft.note.trim() || null,
      })
      setDraft(EMPTY_PROMO)
      await reload()
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 409 ? 'promoExists' : 'promoInvalid')
    }
  }

  const togglePromo = async (promo: BillingPromo) => {
    setError(null)
    try {
      await billingAdminApi.setPromoActive(promo.id, !promo.active)
      await reload()
    } catch {
      setError('save')
    }
  }

  const addOrganizer = async () => {
    if (!login.trim()) return
    setError(null)
    try {
      await billingAdminApi.addFreeOrganizer(login.trim(), organizerNote)
      setLogin('')
      setOrganizerNote('')
      await reload()
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 404 ? 'userNotFound' : 'save')
    }
  }

  const removeOrganizer = async (userId: number) => {
    setError(null)
    try {
      await billingAdminApi.removeFreeOrganizer(userId)
      await reload()
    } catch {
      setError('save')
    }
  }

  return {
    promos, organizers, draft, setDraft, login, setLogin, organizerNote, setOrganizerNote, error,
    createPromo, togglePromo, addOrganizer, removeOrganizer,
  }
}
