/** BillingController：錯誤對應成 HTTP 狀態、結帳限流、webhook 讀原始 body。服務本身見 billing.service.test.ts。 */
import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { BillingController } from '../../../../src/nest/billing/billing.controller';
import type { BillingService } from '../../../../src/nest/billing/billing.service';
import { RateLimitService } from '../../../../src/nest/common/rate-limit.service';
import type { User } from '../../../../src/types';

const user = { id: 7, username: 'u', email: 'u@example.test', role: 'user' } as User;

function make(over: Partial<Record<keyof BillingService, unknown>> = {}) {
  const svc = {
    plan: vi.fn(() => ({ enabled: false })),
    startCheckout: vi.fn(async () => ({ ok: true, url: 'https://checkout.recur.tw/cs_1', ref: 'r1' })),
    getPurchase: vi.fn(() => null),
    handleWebhook: vi.fn(() => ({ status: 200, body: { ok: true, outcome: 'fulfilled' } })),
    ...over,
  };
  return { svc, ctl: new BillingController(svc as unknown as BillingService, new RateLimitService()) };
}

async function status(p: Promise<unknown> | (() => unknown)): Promise<number> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    return (e as HttpException).getStatus();
  }
  return 200;
}

describe('BillingController', () => {
  it('BILLCTL-001: plan 原樣回傳', () => {
    const { ctl } = make();
    expect(ctl.plan()).toEqual({ enabled: false });
  });

  it('BILLCTL-002: checkout 成功回 url 與 ref；服務說關閉就回 503', async () => {
    const { ctl } = make();
    expect(await ctl.checkout(user, { consent: true, consent_ver: 'v' })).toEqual({ url: 'https://checkout.recur.tw/cs_1', ref: 'r1' });
    const off = make({ startCheckout: vi.fn(async () => ({ ok: false, status: 503, error: 'billing_disabled' })) });
    expect(await status(off.ctl.checkout(user, { consent: true, consent_ver: 'v' }))).toBe(503);
  });

  it('BILLCTL-003: 同一人 15 分鐘內第 11 次結帳 → 429', async () => {
    const { ctl } = make();
    for (let i = 0; i < 10; i++) await ctl.checkout(user, { consent: true, consent_ver: 'v' });
    expect(await status(ctl.checkout(user, { consent: true, consent_ver: 'v' }))).toBe(429);
  });

  it('BILLCTL-004: 找不到購買 → 404', async () => {
    const { ctl } = make();
    expect(await status(() => ctl.purchase(user, 'nope'))).toBe(404);
  });

  it('BILLCTL-005: webhook 把 rawBody 與簽章交給服務；非 200 轉成例外', async () => {
    const { ctl, svc } = make();
    const raw = Buffer.from('{}');
    const req = { rawBody: raw, get: (h: string) => (h === 'x-recur-signature' ? 'sig' : undefined) } as unknown as Request;
    expect(ctl.recurWebhook(req)).toEqual({ ok: true, outcome: 'fulfilled' });
    expect(svc.handleWebhook).toHaveBeenCalledWith(raw, 'sig');
    const bad = make({ handleWebhook: vi.fn(() => ({ status: 401, body: { ok: false, error: 'bad_signature' } })) });
    expect(await status(() => bad.ctl.recurWebhook(req))).toBe(401);
  });
});
