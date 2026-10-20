import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { BillingPlan } from '@trek/shared'
import { billingApi } from '../../api/billing'
import { useAuthStore } from '../../store/authStore'
import { openCheckout } from './openCheckout'

export type PricingError = 'generic' | 'consentOutdated' | null

/**
 * 收費頁的資料與動作。未登入也看得到價格；按購買時沒登入就先去登入、登入完回來這頁。
 * 七日解除權的同意框預設不勾，沒勾不能結帳（billing-plan §4-1）。
 */
export function usePricing() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PricingError>(null)

  useEffect(() => {
    let cancelled = false
    billingApi.plan()
      .then((p) => { if (!cancelled) setPlan(p) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [])

  const enabled = !!plan?.enabled
  const canBuy = enabled && isAuthenticated && consent && !busy

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
      const res = await billingApi.checkout(plan.consent_ver)
      openCheckout(res.url)
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 409 ? 'consentOutdated' : 'generic')
      setBusy(false)
    }
  }

  return {
    plan,
    loadFailed,
    enabled,
    isAuthenticated,
    consent,
    setConsent,
    busy,
    error,
    canBuy,
    buy,
    canceled: params.get('canceled') === '1',
  }
}
