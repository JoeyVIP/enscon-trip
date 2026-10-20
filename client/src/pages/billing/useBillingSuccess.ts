import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { BillingPurchase } from '@trek/shared'
import { billingApi } from '../../api/billing'

export const POLL_MS = 2500
/** 等這麼多次還沒收到付款通知，就跟付款人說「比平常久」（還是會繼續等）。 */
export const SLOW_AFTER = 12
export const MAX_POLLS = 72

export type SuccessState = 'loading' | 'pending' | 'fulfilled' | 'failed' | 'refunded' | 'partially_refunded' | 'notFound'

/**
 * /billing/success?ref=… — 從 Recur 付款頁回來。webhook 可能比人先到也可能晚到，
 * 所以每 2.5 秒問一次自己那一筆的狀態，團開好了就顯示邀請連結與下一步。
 */
export function useBillingSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''
  const [purchase, setPurchase] = useState<BillingPurchase | null>(null)
  const [state, setState] = useState<SuccessState>(ref ? 'loading' : 'notFound')
  const [polls, setPolls] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!ref) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let count = 0
    const tick = () => {
      billingApi.purchase(ref)
        .then((p) => {
          if (cancelled) return
          setPurchase(p)
          count += 1
          setPolls(count)
          if (p.status === 'pending') {
            setState('pending')
            if (count < MAX_POLLS) timer = setTimeout(tick, POLL_MS)
            return
          }
          setState(p.status === 'payment_failed' ? 'failed' : p.status)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          if ((err as { response?: { status?: number } }).response?.status === 404) {
            setState('notFound')
            return
          }
          // 網路一時不通：照樣再問
          count += 1
          setPolls(count)
          if (count < MAX_POLLS) timer = setTimeout(tick, POLL_MS)
        })
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [ref])

  const inviteUrl = purchase?.invite_token ? `${window.location.origin}/join/${purchase.invite_token}` : null

  const copyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const openTrip = () => {
    if (purchase?.trip_id) navigate(`/trips/${purchase.trip_id}`)
  }
  const backToPricing = () => navigate('/pricing')

  return { state, purchase, inviteUrl, copied, copyInvite, openTrip, backToPricing, slow: state === 'pending' && polls >= SLOW_AFTER }
}
