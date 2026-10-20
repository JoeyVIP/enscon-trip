import { z } from 'zod';

/**
 * ENSCON 旅程按趟收費的 API 契約（Recur 單次付款，付款後自動開團）。
 *
 * - GET  /api/billing/plan              未登入也能讀：價格、名額、天數、收費開了沒、條款／隱私連結
 * - POST /api/billing/checkout          登入後：同意框打勾才建 Recur 結帳，回傳要跳轉的付款頁網址
 * - GET  /api/billing/purchases/:ref    登入後：自己那一筆的狀態（付款完成頁輪詢用）
 * - POST /api/billing/webhook/recur     Recur 打進來的通知（驗簽，不吃這份契約）
 *
 * 七日解除權的排除要「付款前告知＋事先同意＋交付後再告知」三件都有（billing-plan §4-1），
 * 所以同意框的版本號放在這裡，前後端讀同一個值；版本不對伺服器就拒收，避免舊頁面送出沒看過的條件。
 */
export const TRIP_BILLING_CONSENT_VERSION = '2026-10-20';

export const billingCheckoutRequestSchema = z.object({
  consent: z.literal(true),
  consent_ver: z.string().min(1).max(40),
});
export type BillingCheckoutRequest = z.infer<typeof billingCheckoutRequestSchema>;

export const billingPlanSchema = z.object({
  enabled: z.boolean(),
  price_twd: z.number().int().positive(),
  seats: z.number().int().positive(),
  days_after_return: z.number().int().nonnegative(),
  consent_ver: z.string(),
  terms_url: z.string(),
  privacy_url: z.string(),
});
export type BillingPlan = z.infer<typeof billingPlanSchema>;

export const billingCheckoutResponseSchema = z.object({
  url: z.string().startsWith('https://'),
  ref: z.string(),
});
export type BillingCheckoutResponse = z.infer<typeof billingCheckoutResponseSchema>;

/**
 * 一筆購買在付款人眼中的狀態。
 * pending＝已建結帳、還沒收到付款通知；fulfilled＝團開好了；
 * payment_failed／refunded／partially_refunded 照 Recur 事件記。
 */
export const BILLING_PURCHASE_STATUSES = [
  'pending',
  'fulfilled',
  'payment_failed',
  'refunded',
  'partially_refunded',
] as const;
export type BillingPurchaseStatus = (typeof BILLING_PURCHASE_STATUSES)[number];

export const billingPurchaseSchema = z.object({
  ref: z.string(),
  status: z.enum(BILLING_PURCHASE_STATUSES),
  trip_id: z.number().int().nullable(),
  trip_title: z.string().nullable(),
  invite_token: z.string().nullable(),
  seats: z.number().int(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  paid_at: z.string().nullable(),
});
export type BillingPurchase = z.infer<typeof billingPurchaseSchema>;
