/**
 * ENSCON 旅程按趟收費：BillingService 對真的 in-memory SQLite 跑。
 * 開團用的 TripsService 換成只寫 trips 一列的替身（它的建行程邏輯有自己的測試），
 * 邀請連結用真的 TripInviteService，寄信換成替身。
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  const mock = {
    db,
    closeDb: () => {},
    reinitialize: () => {},
    getPlaceWithTags: () => null,
    canAccessTrip: () => undefined,
    isOwner: () => false,
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../../../src/db/database', () => dbMock);
vi.mock('../../../../src/config', () => ({
  JWT_SECRET: 'test-secret',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));

import { TRIP_BILLING_CONSENT_VERSION } from '@trek/shared';
import { createTables } from '../../../../src/db/schema';
import { runMigrations } from '../../../../src/db/migrations';
import { resetTestDb } from '../../../helpers/test-db';
import { createAdmin, createUser } from '../../../helpers/factories';
import { DatabaseService } from '../../../../src/nest/database/database.service';
import { PermissionsService } from '../../../../src/nest/permissions/permissions.service';
import { TripMembershipService } from '../../../../src/nest/trip-membership/trip-membership.service';
import { TripInviteService } from '../../../../src/nest/trip-invite/trip-invite.service';
import type { TripsService } from '../../../../src/nest/trips/trips.service';
import type { MailerService } from '../../../../src/nest/notifications/mailer/mailer.service';
import { BillingService } from '../../../../src/nest/billing/billing.service';
import { signRecurBody } from '../../../../src/nest/billing/recur';

const SECRET = 'whsec_unit_test_only';
const PRODUCT = 'prod_trip_once_test';

const dbs = new DatabaseService(testDb);
const invites = new TripInviteService(dbs, new PermissionsService(dbs), new TripMembershipService(dbs));
const tripsCreate = vi.fn((userId: number, data: { title: string }, _opts?: { paid?: boolean }) => {
  const r = testDb.prepare('INSERT INTO trips (user_id, title) VALUES (?, ?)').run(userId, data.title);
  return { trip: null, tripId: Number(r.lastInsertRowid), reminderDays: 3 };
});
const sendEmail = vi.fn(async () => true);
const svc = new BillingService(
  dbs,
  { create: tripsCreate } as unknown as TripsService,
  invites,
  { sendEmail } as unknown as MailerService,
);

const ENV_KEYS = ['RECUR_SECRET_KEY', 'RECUR_WEBHOOK_SECRET', 'RECUR_PRODUCT_TRIP_ONCE', 'TRIP_BILLING_PRICE_TWD', 'TRIP_BILLING_SEATS'];
function enableBilling() {
  process.env.RECUR_SECRET_KEY = 'sk_test_unit_dummy';
  process.env.RECUR_WEBHOOK_SECRET = SECRET;
  process.env.RECUR_PRODUCT_TRIP_ONCE = PRODUCT;
}

function okFetch(id = 'cs_test_1') {
  return vi.fn(async () => new Response(JSON.stringify({ id, url: `https://checkout.recur.tw/${id}` }), { status: 201 }));
}

/** 付款人登入後建一筆結帳，回傳 ref。 */
async function checkout(userId: number, sessionId = 'cs_test_1') {
  const res = await svc.startCheckout({ id: userId }, TRIP_BILLING_CONSENT_VERSION, undefined, okFetch(sessionId) as unknown as typeof fetch);
  if (!res.ok) throw new Error('checkout failed');
  return res.ref;
}

function deliver(evt: object, secret = SECRET) {
  const raw = Buffer.from(JSON.stringify(evt));
  return svc.handleWebhook(raw, signRecurBody(secret, raw));
}

function paidEvent(over: Record<string, unknown> = {}, id = 'evt_paid_1') {
  return {
    id,
    type: 'order.paid',
    timestamp: '2026-10-20T08:00:00.000Z',
    data: {
      id: 'ord_1', order_id: 'ord_1', product_id: PRODUCT, checkout_id: 'cs_test_1', amount: 299, currency: 'TWD',
      status: 'paid', billing_reason: 'purchase', paid_at: '2026-10-20T08:00:00.000Z',
      customer: { id: 'cus_1', email: 'payer@example.test' },
      ...over,
    },
  };
}

const purchaseRow = (ref: string) =>
  testDb.prepare('SELECT * FROM billing_purchases WHERE ref = ?').get(ref) as Record<string, unknown>;
const tripCount = () => (testDb.prepare('SELECT COUNT(*) AS n FROM trips').get() as { n: number }).n;

beforeAll(() => { createTables(testDb); runMigrations(testDb); });
beforeEach(() => {
  resetTestDb(testDb);
  for (const k of ENV_KEYS) delete process.env[k];
  tripsCreate.mockClear();
  sendEmail.mockClear();
});
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
afterAll(() => testDb.close());

describe('BillingService.plan', () => {
  it('BILL-001: 金鑰空＝收費關閉，價格名額用預設值', () => {
    expect(svc.plan()).toEqual({
      enabled: false, price_twd: 299, seats: 10, days_after_return: 30,
      consent_ver: TRIP_BILLING_CONSENT_VERSION, terms_url: '/legal/terms', privacy_url: '/legal/privacy',
    });
  });

  it('BILL-002: 三個設定都有才開啟，回應裡不出現金鑰', () => {
    enableBilling();
    process.env.TRIP_BILLING_PRICE_TWD = '399';
    const plan = svc.plan();
    expect(plan.enabled).toBe(true);
    expect(plan.price_twd).toBe(399);
    expect(JSON.stringify(plan)).not.toContain('sk_test');
    expect(JSON.stringify(plan)).not.toContain(SECRET);
    delete process.env.RECUR_WEBHOOK_SECRET;
    expect(svc.plan().enabled).toBe(false);
  });
});

describe('BillingService.startCheckout', () => {
  it('BILL-010: 收費關閉時不打 Recur，回 503', async () => {
    const f = okFetch();
    const res = await svc.startCheckout({ id: 1 }, TRIP_BILLING_CONSENT_VERSION, undefined, f as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, status: 503, error: 'billing_disabled' });
    expect(f).not.toHaveBeenCalled();
  });

  it('BILL-011: 同意的版本不是現行版本 → 409', async () => {
    enableBilling();
    const res = await svc.startCheckout({ id: 1 }, '1999-01-01', undefined, okFetch() as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, status: 409, error: 'consent_outdated' });
  });

  it('BILL-012: 成功時寫一列 pending，記下同意時間與版本，metadata 帶 purchase_ref', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const f = okFetch('cs_test_abc');
    const res = await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, undefined, f as unknown as typeof fetch);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.url).toBe('https://checkout.recur.tw/cs_test_abc');
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toMatchObject({ product_id: PRODUCT, mode: 'PAYMENT', metadata: { purchase_ref: res.ref, user_id: String(user.id) } });
    expect(sent.success_url).toContain(`/billing/success?ref=${res.ref}`);
    const row = purchaseRow(res.ref);
    expect(row).toMatchObject({ user_id: user.id, checkout_id: 'cs_test_abc', status: 'pending', seats: 10, consent_ver: TRIP_BILLING_CONSENT_VERSION, livemode: 0, invoice_status: 'none' });
    expect(row.consent_at).toEqual(expect.any(String));
  });

  it('BILL-013: Recur 回錯誤 → 502，不寫任何一列', async () => {
    enableBilling();
    const f = vi.fn(async () => new Response('{"error":"x"}', { status: 400 }));
    const res = await svc.startCheckout({ id: 1 }, TRIP_BILLING_CONSENT_VERSION, undefined, f as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, status: 502, error: 'recur_error' });
    expect((testDb.prepare('SELECT COUNT(*) AS n FROM billing_purchases').get() as { n: number }).n).toBe(0);
  });
});

describe('BillingService.handleWebhook — 驗簽', () => {
  it('BILL-020: 沒設 webhook secret 時一律拒收（503），不處理', async () => {
    const res = svc.handleWebhook(Buffer.from('{}'), 'whatever');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('webhook_not_configured');
  });

  it('BILL-021: 簽章不對、沒帶簽章、空 body 都拒收', () => {
    enableBilling();
    const raw = Buffer.from(JSON.stringify(paidEvent()));
    expect(svc.handleWebhook(raw, signRecurBody('whsec_other', raw)).status).toBe(401);
    expect(svc.handleWebhook(raw, undefined).status).toBe(401);
    expect(svc.handleWebhook(undefined, 'x').status).toBe(400);
    expect((testDb.prepare('SELECT COUNT(*) AS n FROM billing_events').get() as { n: number }).n).toBe(0);
  });

  it('BILL-022: 簽章對但不是事件格式 → 400', () => {
    enableBilling();
    expect(deliver({ hello: 'world' }).status).toBe(400);
    const raw = Buffer.from('not json');
    expect(svc.handleWebhook(raw, signRecurBody(SECRET, raw)).status).toBe(400);
  });
});

describe('BillingService.handleWebhook — 付款成功開團', () => {
  it('BILL-030: order.paid → 開一團給付款人、產生邀請連結、狀態 fulfilled、寄信', async () => {
    enableBilling();
    const { user } = createUser(testDb, { username: 'joey' });
    const ref = await checkout(user.id);
    const res = deliver(paidEvent());
    expect(res).toEqual({ status: 200, body: { ok: true, outcome: 'fulfilled' } });

    const row = purchaseRow(ref);
    expect(row).toMatchObject({ status: 'fulfilled', order_id: 'ord_1', amount: 299, currency: 'TWD', payer_email: 'payer@example.test', invoice_status: 'pending' });
    const trip = testDb.prepare('SELECT * FROM trips WHERE id = ?').get(row.trip_id) as { user_id: number; title: string };
    expect(trip.user_id).toBe(user.id);
    expect(trip.title).toBe('joey 的旅程');
    // 開團走付款這條路，帶 paid 跳過「開新團要先付款」的檢查
    expect(tripsCreate.mock.calls[0][2]).toEqual({ paid: true });
    expect(invites.get(row.trip_id as number)?.token).toEqual(expect.any(String));

    const view = svc.getPurchase(user.id, ref);
    expect(view).toMatchObject({ status: 'fulfilled', trip_id: row.trip_id, trip_title: 'joey 的旅程', seats: 10 });
    expect(view?.invite_token).toBe(invites.get(row.trip_id as number)?.token);

    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(1));
    const [to, , body, uid, target] = sendEmail.mock.calls[0] as unknown as [string, string, string, number, string];
    expect(to).toBe('payer@example.test');
    expect(uid).toBe(user.id);
    expect(target).toBe(`/billing/success?ref=${ref}`);
    expect(body).toContain('第 2 條第 5 款');
    // 信裡不放邀請連結本身
    expect(body).not.toContain(view?.invite_token as string);
  });

  it('BILL-031: 同一則通知重送 → duplicate，不會開第二團', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    await checkout(user.id);
    expect(deliver(paidEvent()).body.outcome).toBe('fulfilled');
    expect(deliver(paidEvent()).body.outcome).toBe('duplicate');
    expect(tripCount()).toBe(1);
    expect(tripsCreate).toHaveBeenCalledTimes(1);
  });

  it('BILL-032: 同一張訂單換了事件 id 再來 → already_fulfilled，還是只有一團', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    await checkout(user.id);
    deliver(paidEvent({}, 'evt_a'));
    expect(deliver(paidEvent({}, 'evt_b')).body.outcome).toBe('already_fulfilled');
    expect(tripCount()).toBe(1);
  });

  it('BILL-033: 不是我們的商品 → ignored，不開團', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    await checkout(user.id);
    expect(deliver(paidEvent({ product_id: 'prod_someone_else' })).body.outcome).toBe('ignored');
    expect(tripCount()).toBe(0);
  });

  it('BILL-034: 對不上結帳 session → unmatched，有記事件，不開團', () => {
    enableBilling();
    expect(deliver(paidEvent({ checkout_id: 'cs_unknown' })).body.outcome).toBe('unmatched');
    expect(tripCount()).toBe(0);
    expect(testDb.prepare('SELECT outcome FROM billing_events WHERE event_id = ?').get('evt_paid_1')).toEqual({ outcome: 'unmatched' });
  });

  it('BILL-035: checkout_id 對不到但 metadata.purchase_ref 對得到 → 照樣開團', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const ref = await checkout(user.id);
    expect(deliver(paidEvent({ checkout_id: 'chk_other_prefix', metadata: { purchase_ref: ref } })).body.outcome).toBe('fulfilled');
  });

  it('BILL-036: 付款失敗 → payment_failed；之後同一個結帳付成功還是能開團', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const ref = await checkout(user.id);
    expect(deliver({ id: 'evt_fail', type: 'order.payment_failed', data: { id: 'ord_0', checkout_id: 'cs_test_1' } }).body.outcome).toBe('payment_failed');
    expect(purchaseRow(ref).status).toBe('payment_failed');
    expect(deliver(paidEvent()).body.outcome).toBe('fulfilled');
  });

  it('BILL-037: checkout.completed 只記付款 Email', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const ref = await checkout(user.id);
    const evt = { id: 'evt_cc', type: 'checkout.completed', data: { id: 'cs_test_1', product_id: PRODUCT, customer_email: 'cc@example.test' } };
    expect(deliver(evt).body.outcome).toBe('recorded');
    expect(purchaseRow(ref)).toMatchObject({ status: 'pending', payer_email: 'cc@example.test' });
    expect(tripCount()).toBe(0);
  });

  it('BILL-038: 別人看不到這一筆', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const { user: other } = createUser(testDb);
    const ref = await checkout(user.id);
    deliver(paidEvent());
    expect(svc.getPurchase(other.id, ref)).toBeNull();
    expect(svc.getPurchase(user.id, 'nope')).toBeNull();
  });
});

describe('BillingService.handleWebhook — 退款', () => {
  function refundEvent(refunded: number, original: number, id = 'evt_ref_1') {
    return { id, type: 'refund.succeeded', data: { id: 'ref_1', order_id: 'ord_1', refunded_amount: refunded, original_amount: original, amount: refunded, status: 'succeeded' } };
  }

  it('BILL-040: 全額退款 → refunded，邀請連結刪掉，行程留著', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const ref = await checkout(user.id);
    deliver(paidEvent());
    const tripId = purchaseRow(ref).trip_id as number;
    expect(deliver(refundEvent(299, 299)).body.outcome).toBe('refunded');
    expect(purchaseRow(ref)).toMatchObject({ status: 'refunded', refunded_amount: 299 });
    expect(invites.get(tripId)).toBeNull();
    expect(tripCount()).toBe(1);
    expect(svc.getPurchase(user.id, ref)?.invite_token).toBeNull();
  });

  it('BILL-041: 部分退款 → partially_refunded，邀請連結保留', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    const ref = await checkout(user.id);
    deliver(paidEvent());
    const tripId = purchaseRow(ref).trip_id as number;
    expect(deliver(refundEvent(100, 299)).body.outcome).toBe('partially_refunded');
    expect(purchaseRow(ref).status).toBe('partially_refunded');
    expect(invites.get(tripId)).not.toBeNull();
  });

  it('BILL-042: 對不上的訂單退款 → ignored；退款處理中／失敗事件只記錄', async () => {
    enableBilling();
    expect(deliver(refundEvent(299, 299)).body.outcome).toBe('ignored');
    const { user } = createUser(testDb);
    await checkout(user.id);
    deliver(paidEvent());
    expect(deliver({ id: 'evt_rc', type: 'refund.created', data: { id: 'ref_2', order_id: 'ord_1', status: 'pending' } }).body.outcome).toBe('recorded');
    expect(deliver({ id: 'evt_x', type: 'subscription.created', data: { id: 'sub_1' } }).body.outcome).toBe('ignored');
  });

  it('BILL-043: 退款後再來一次付款通知（換事件 id）不會再開團', async () => {
    enableBilling();
    const { user } = createUser(testDb);
    await checkout(user.id);
    deliver(paidEvent());
    deliver(refundEvent(299, 299));
    expect(deliver(paidEvent({}, 'evt_paid_again')).body.outcome).toBe('already_fulfilled');
    expect(tripCount()).toBe(1);
  });
});

describe('BillingService.notifyPayer', () => {
  it('BILL-050: 寄信失敗不丟例外', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(svc.notifyPayer({ to: 'a@example.test', ref: 'r', userId: 1 })).resolves.toBe(false);
  });
});

describe('優惠碼', () => {
  function admin() { return createAdmin(testDb).user; }
  const used = (code: string) =>
    (testDb.prepare('SELECT used_count FROM billing_promo_codes WHERE code = ?').get(code) as { used_count: number }).used_count;

  it('PROMO-001: 100% 優惠碼 → 不打 Recur、直接開團、url 為 null、次數 +1、金額 0', async () => {
    enableBilling();
    svc.createPromo(admin().id, { code: 'free100', percent_off: 100 });
    const { user } = createUser(testDb);
    const f = okFetch();
    const res = await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, ' Free100 ', f as unknown as typeof fetch);
    expect(res).toMatchObject({ ok: true, url: null });
    expect(f).not.toHaveBeenCalled();
    if (!res.ok) return;
    expect(purchaseRow(res.ref)).toMatchObject({ status: 'fulfilled', amount: 0, promo_code: 'FREE100', invoice_status: 'none' });
    expect(used('FREE100')).toBe(1);
    expect(tripCount()).toBe(1);
    expect(svc.getPurchase(user.id, res.ref)?.invite_token).toEqual(expect.any(String));
  });

  it('PROMO-002: 次數上限用完 → promo_used_up，不開第二團', async () => {
    enableBilling();
    svc.createPromo(admin().id, { code: 'ONCE', percent_off: 100, max_uses: 1 });
    const { user } = createUser(testDb);
    expect((await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'ONCE')).ok).toBe(true);
    expect(await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'ONCE')).toEqual({ ok: false, status: 400, error: 'promo_used_up' });
    expect(tripCount()).toBe(1);
    expect(used('ONCE')).toBe(1);
  });

  it('PROMO-003: 過期、停用、不存在的碼都不能用', async () => {
    enableBilling();
    const a = admin();
    svc.createPromo(a.id, { code: 'OLD', percent_off: 100, expires_on: '2020-01-01' });
    const off = svc.createPromo(a.id, { code: 'OFF', percent_off: 100 });
    if ('error' in off) throw new Error('create failed');
    expect(svc.setPromoActive(off.id, false)?.active).toBe(false);
    const { user } = createUser(testDb);
    expect(await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'OLD')).toMatchObject({ ok: false, error: 'promo_expired' });
    expect(await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'OFF')).toMatchObject({ ok: false, error: 'promo_not_found' });
    expect(await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'NOPE')).toMatchObject({ ok: false, error: 'promo_not_found' });
    expect(tripCount()).toBe(0);
  });

  it('PROMO-004: 到期日是台灣時間那天的最後一刻', () => {
    const p = svc.createPromo(admin().id, { code: 'NEWYEAR', percent_off: 100, expires_on: '2027-01-01' });
    expect(p).toMatchObject({ expires_at: '2027-01-01T15:59:59.999Z' });
  });

  it('PROMO-005: 打折的碼 → 帶給 Recur 的 promotion_code，付款成功才算用掉一次', async () => {
    enableBilling();
    svc.createPromo(admin().id, { code: 'HALF', percent_off: 50 });
    const { user } = createUser(testDb);
    const f = okFetch();
    const res = await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'half', f as unknown as typeof fetch);
    expect(res).toMatchObject({ ok: true, url: 'https://checkout.recur.tw/cs_test_1' });
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.promotion_code).toBe('HALF');
    expect(used('HALF')).toBe(0);
    deliver(paidEvent({ amount: 150 }));
    expect(used('HALF')).toBe(1);
    deliver(paidEvent({ amount: 150 }));
    expect(used('HALF')).toBe(1);
  });

  it('PROMO-006: 收費關閉時優惠碼也不能用（行為不變：即將開放）', async () => {
    svc.createPromo(admin().id, { code: 'FREE100', percent_off: 100 });
    const { user } = createUser(testDb);
    expect(await svc.startCheckout({ id: user.id }, TRIP_BILLING_CONSENT_VERSION, 'FREE100')).toEqual({ ok: false, status: 503, error: 'billing_disabled' });
    expect(tripCount()).toBe(0);
  });

  it('PROMO-007: 同一個碼不能建兩次（大小寫不分），列表看得到次數', () => {
    const a = admin();
    svc.createPromo(a.id, { code: 'DUP', percent_off: 10, max_uses: 5, note: '測試' });
    expect(svc.createPromo(a.id, { code: 'dup', percent_off: 20 })).toEqual({ error: 'promo_exists' });
    expect(svc.listPromos()).toEqual([expect.objectContaining({ code: 'DUP', percent_off: 10, max_uses: 5, used_count: 0, active: true, note: '測試' })]);
    expect(svc.setPromoActive(999, true)).toBeNull();
  });
});
