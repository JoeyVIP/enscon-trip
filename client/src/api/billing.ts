import type { BillingCheckoutResponse, BillingPlan, BillingPurchase } from '@trek/shared'
import { apiClient } from './client'

// ENSCON 旅程按趟收費：收費頁（未登入也能讀 plan）、建結帳、付款完成頁查自己那一筆。
export const billingApi = {
  plan: (): Promise<BillingPlan> => apiClient.get('/billing/plan').then(r => r.data),
  checkout: (consentVer: string): Promise<BillingCheckoutResponse> =>
    apiClient.post('/billing/checkout', { consent: true, consent_ver: consentVer }).then(r => r.data),
  purchase: (ref: string): Promise<BillingPurchase> =>
    apiClient.get(`/billing/purchases/${encodeURIComponent(ref)}`).then(r => r.data),
}
