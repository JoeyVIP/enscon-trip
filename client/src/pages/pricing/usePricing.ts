import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { BillingMe, BillingPlan } from '@trek/shared'
import { billingApi } from '../../api/billing'
import { useAuthStore } from '../../store/authStore'
import { openCheckout } from './openCheckout'

export type PricingError = 'generic' | 'consentOutdated' | 'promoNotFound' | 'promoExpired' | 'promoUsedUp' | null

const SERVER_ERRORS: Record<string, PricingError> = {
  consent_outdated: 'consentOutdated',
  promo_not_found: 'promoNotFound',
  promo_expired: 'promoExpired',
  promo_used_up: 'promoUsedUp',
}

/**
 * 收費頁的資料與動作。未登入也看得到價格；按購買時沒登入就先去登入、登入完回來這頁。
 * 七日解除權的同意框預設不勾，沒勾不能結帳（billing-plan §4-1）。
 * 優惠碼 100% 折抵時伺服器直接開團（回 url null），就直接到付款完成頁。
 * 不用付款就能開團的人（管理員、免費主揪）會看到「直接開團」的提示。
 */
export function usePricing() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [me, setMe] = useState<BillingMe | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [consent, setConsent] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PricingError>(null)

  useEffect(() => {
    let cancelled = false
    billingApi.plan()
      .then((p) => { if (!cancelled) setPlan(p) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) { setMe(null); return }
    let cancelled = false
    billingApi.me()
      .then((m) => { if (!cancelled) setMe(m) })
      .catch(() => { if (!cancelled) setMe(null) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  const enabled = !!plan?.enabled
  const canBuy = enabled && isAuthenticated && consent && !busy
  // 收費開著、而且這個人開新團不用付款（管理員、免費主揪）
  const canOpenFree = enabled && isAuthenticated && me?.needs_purchase === false

  const buy = async () => {
    if (!plan || !enabled || busy) return
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent('/pricing')}`)
      return
    }
    if (!consent) return
    setBusy(true)
    setError(null)
    try {
      const res = await billingApi.checkout(plan.consent_ver, promoCode)
      if (res.url) {
        openCheckout(res.url)
      } else {
        navigate(`/billing/success?ref=${encodeURIComponent(res.ref)}`)
      }
    } catch (err) {
      const code = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError((code && SERVER_ERRORS[code]) || 'generic')
      setBusy(false)
    }
  }

  const goDashboard = () => navigate('/dashboard')

  return {
    plan,
    loadFailed,
    enabled,
    isAuthenticated,
    consent,
    setConsent,
    promoCode,
    setPromoCode,
    busy,
    error,
    canBuy,
    canOpenFree,
    freeOrganizer: !!me?.free_organizer,
    buy,
    goDashboard,
    canceled: params.get('canceled') === '1',
  }
}
