/** BillingController：錯誤對應成 HTTP 狀態、結帳限流、webhook 讀原始 body。服務本身見 billing.service.test.ts。 */
import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { BillingAdminController, BillingController } from '../../../../src/nest/billing/billing.controller';
import type { AuditService } from '../../../../src/nest/audit/audit.service';
import type { BillingService } from '../../../../src/nest/billing/billing.service';
import { RateLimitService } from '../../../../src/nest/common/rate-limit.service';
import type { User } from '../../../../src/types';

const user = { id: 7, username: 'u', email: 'u@example.test', role: 'user' } as User;

function make(over: Partial<Record<keyof BillingService, unknown>> = {}) {
  const svc = {
    plan: vi.fn(() => ({ enabled: false })),
    startCheckout: vi.fn(async () => ({ ok: true, url: 'https://checkout.recur.tw/cs_1', ref: 'r1' })),
    getPurchase: vi.fn(() => null),
    me: vi.fn(() => ({ needs_purchase: true, free_organizer: false })),
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
    expect(await ctl.checkout(user, { consent: true, consent_ver: 'v', promo_code: 'FREE100' })).toEqual({ url: 'https://checkout.recur.tw/cs_1', ref: 'r1' });
    expect(make().ctl.me(user)).toEqual({ needs_purchase: true, free_organizer: false });
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

describe('BillingAdminController', () => {
  const req = { ip: '127.0.0.1', headers: {}, socket: {} } as unknown as Request;
  const promo = { id: 1, code: 'FREE100', percent_off: 100, max_uses: null, used_count: 0, expires_at: null, active: true, note: null, created_at: 'x' };
  function admin(over: Record<string, unknown> = {}) {
    const svc = {
      listPromos: vi.fn(() => [promo]),
      createPromo: vi.fn(() => promo),
      setPromoActive: vi.fn(() => ({ ...promo, active: false })),
      listFreeOrganizers: vi.fn(() => []),
      addFreeOrganizer: vi.fn(() => ({ user_id: 3, username: 'tomato', email: 't@example.test', note: null, created_at: 'x' })),
      removeFreeOrganizer: vi.fn(() => true),
      ...over,
    };
    const writeAudit = vi.fn();
    return { svc, writeAudit, ctl: new BillingAdminController(svc as unknown as BillingService, { writeAudit } as unknown as AuditService) };
  }

  it('BILLADM-001: 優惠碼：列表、建立（記稽核）、重複 → 409、停用、找不到 → 404', async () => {
    const { ctl, writeAudit } = admin();
    expect(ctl.listPromos()).toEqual({ promo_codes: [promo] });
    expect(ctl.createPromo(user, { code: 'FREE100', percent_off: 100 }, req)).toEqual(promo);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'billing.promo_create', resource: 'FREE100' }));
    expect(ctl.updatePromo(user, '1', { active: false }, req).active).toBe(false);
    expect(await status(() => admin({ createPromo: vi.fn(() => ({ error: 'promo_exists' })) }).ctl.createPromo(user, { code: 'X12', percent_off: 1 }, req))).toBe(409);
    expect(await status(() => admin({ setPromoActive: vi.fn(() => null) }).ctl.updatePromo(user, '9', { active: true }, req))).toBe(404);
  });

  it('BILLADM-002: 免費主揪：列表、加入、找不到帳號 → 404、移除', async () => {
    const { ctl, writeAudit } = admin();
    expect(ctl.listFreeOrganizers()).toEqual({ free_organizers: [] });
    expect(ctl.addFreeOrganizer(user, { login: 'tomato' }, req)).toMatchObject({ user_id: 3 });
    expect(ctl.removeFreeOrganizer(user, '3', req)).toEqual({ success: true });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'billing.free_organizer_remove', resource: '3' }));
    expect(await status(() => admin({ addFreeOrganizer: vi.fn(() => ({ error: 'user_not_found' })) }).ctl.addFreeOrganizer(user, { login: 'x' }, req))).toBe(404);
    expect(await status(() => admin({ removeFreeOrganizer: vi.fn(() => false) }).ctl.removeFreeOrganizer(user, '4', req))).toBe(404);
  });
});
