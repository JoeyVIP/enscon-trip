import { describe, it, expect } from 'vitest';
import {
  TRIP_BILLING_CONSENT_VERSION,
  billingCheckoutRequestSchema,
  billingCheckoutResponseSchema,
  billingFreeOrganizerAddRequestSchema,
  billingPlanSchema,
  billingPromoCreateRequestSchema,
  billingPurchaseSchema,
} from './billing.schema';

describe('billing contract', () => {
  it('checkout 只收打勾的同意框', () => {
    expect(billingCheckoutRequestSchema.safeParse({ consent: true, consent_ver: TRIP_BILLING_CONSENT_VERSION }).success).toBe(true);
    expect(billingCheckoutRequestSchema.safeParse({ consent: false, consent_ver: TRIP_BILLING_CONSENT_VERSION }).success).toBe(false);
    expect(billingCheckoutRequestSchema.safeParse({ consent_ver: TRIP_BILLING_CONSENT_VERSION }).success).toBe(false);
    expect(billingCheckoutRequestSchema.safeParse({ consent: true, consent_ver: '' }).success).toBe(false);
  });

  it('plan 的形狀', () => {
    const plan = {
      enabled: false, price_twd: 299, seats: 10, days_after_return: 30,
      consent_ver: TRIP_BILLING_CONSENT_VERSION, terms_url: '/legal/terms', privacy_url: '/legal/privacy',
    };
    expect(billingPlanSchema.parse(plan)).toEqual(plan);
    expect(billingPlanSchema.safeParse({ ...plan, price_twd: 0 }).success).toBe(false);
  });

  it('purchase 只接受已知的狀態', () => {
    const p = {
      ref: 'r', status: 'fulfilled', trip_id: 1, trip_title: 'T', invite_token: 'tok',
      seats: 10, amount: 299, currency: 'TWD', paid_at: '2026-10-20T00:00:00.000Z',
    };
    expect(billingPurchaseSchema.parse(p)).toEqual(p);
    expect(billingPurchaseSchema.safeParse({ ...p, status: 'paid' }).success).toBe(false);
  });

  it('checkout 可以帶優惠碼；100% 折抵時沒有付款頁網址', () => {
    const req = { consent: true, consent_ver: TRIP_BILLING_CONSENT_VERSION, promo_code: ' FREE100 ' };
    expect(billingCheckoutRequestSchema.parse(req).promo_code).toBe('FREE100');
    expect(billingCheckoutResponseSchema.safeParse({ url: null, ref: 'r' }).success).toBe(true);
    expect(billingCheckoutResponseSchema.safeParse({ url: 'http://x', ref: 'r' }).success).toBe(false);
  });

  it('優惠碼：1–100%、次數上限與到期日可不填、代碼格式', () => {
    expect(billingPromoCreateRequestSchema.safeParse({ code: 'FREE100', percent_off: 100 }).success).toBe(true);
    const full = { code: 'TRY-50', percent_off: 50, max_uses: 3, expires_on: '2027-03-31', note: 'x' };
    expect(billingPromoCreateRequestSchema.safeParse(full).success).toBe(true);
    expect(billingPromoCreateRequestSchema.safeParse({ code: 'FREE100', percent_off: 0 }).success).toBe(false);
    expect(billingPromoCreateRequestSchema.safeParse({ code: 'FREE100', percent_off: 101 }).success).toBe(false);
    expect(billingPromoCreateRequestSchema.safeParse({ code: 'a b', percent_off: 10 }).success).toBe(false);
    expect(billingPromoCreateRequestSchema.safeParse({ code: 'OK1', percent_off: 10, expires_on: '2027/3/1' }).success).toBe(
      false,
    );
    expect(billingFreeOrganizerAddRequestSchema.safeParse({ login: '' }).success).toBe(false);
  });
});
