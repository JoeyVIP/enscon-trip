import type {
  BillingCheckoutResponse,
  BillingFreeOrganizer,
  BillingMe,
  BillingPlan,
  BillingPromo,
  BillingPromoCreateRequest,
  BillingPurchase,
} from '@trek/shared'
import { apiClient } from './client'

// ENSCON 旅程按趟收費：收費頁（未登入也能讀 plan）、建結帳、付款完成頁查自己那一筆、管理員後台。
export const billingApi = {
  plan: (): Promise<BillingPlan> => apiClient.get('/billing/plan').then(r => r.data),
  me: (): Promise<BillingMe> => apiClient.get('/billing/me').then(r => r.data),
  checkout: (consentVer: string, promoCode?: string): Promise<BillingCheckoutResponse> =>
    apiClient.post('/billing/checkout', {
      consent: true,
      consent_ver: consentVer,
      ...(promoCode?.trim() ? { promo_code: promoCode.trim() } : {}),
    }).then(r => r.data),
  purchase: (ref: string): Promise<BillingPurchase> =>
    apiClient.get(`/billing/purchases/${encodeURIComponent(ref)}`).then(r => r.data),
}

export const billingAdminApi = {
  listPromos: (): Promise<{ promo_codes: BillingPromo[] }> => apiClient.get('/billing/admin/promo-codes').then(r => r.data),
  createPromo: (body: BillingPromoCreateRequest): Promise<BillingPromo> =>
    apiClient.post('/billing/admin/promo-codes', body).then(r => r.data),
  setPromoActive: (id: number, active: boolean): Promise<BillingPromo> =>
    apiClient.put(`/billing/admin/promo-codes/${id}`, { active }).then(r => r.data),
  listFreeOrganizers: (): Promise<{ free_organizers: BillingFreeOrganizer[] }> =>
    apiClient.get('/billing/admin/free-organizers').then(r => r.data),
  addFreeOrganizer: (login: string, note?: string): Promise<BillingFreeOrganizer> =>
    apiClient.post('/billing/admin/free-organizers', { login, ...(note?.trim() ? { note: note.trim() } : {}) }).then(r => r.data),
  removeFreeOrganizer: (userId: number): Promise<{ success: boolean }> =>
    apiClient.delete(`/billing/admin/free-organizers/${userId}`).then(r => r.data),
}

/** 收費開啟時，沒付款的帳號開新團（建立／複製）伺服器回 402 + code TRIP_PAYMENT_REQUIRED。 */
export function isTripPaymentRequired(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { code?: string } } } | null)?.response
  return res?.status === 402 && res.data?.code === 'TRIP_PAYMENT_REQUIRED'
}
