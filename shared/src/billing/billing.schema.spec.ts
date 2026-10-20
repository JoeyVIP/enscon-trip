import { describe, it, expect } from 'vitest';
import {
  TRIP_BILLING_CONSENT_VERSION,
  billingCheckoutRequestSchema,
  billingPlanSchema,
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
});
