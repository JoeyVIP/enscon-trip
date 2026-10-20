/**
 * 收費只擋「開新團」：建立、複製行程經過 TripsService 的同一道檢查（billing-gate.ts）。
 * 收費關閉時誰都不擋；開啟時管理員、免費主揪不擋；加入別人的團永遠不收錢；
 * 已經存在的沖繩團（行程 id 2）和它的成員不受影響。
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
    canAccessTrip: (tripId: unknown, userId: number) =>
      db.prepare(`
        SELECT t.id, t.user_id FROM trips t
        LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
        WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)
      `).get(userId, tripId, userId),
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

import { createTables } from '../../../../src/db/schema';
import { runMigrations } from '../../../../src/db/migrations';
import { resetTestDb } from '../../../helpers/test-db';
import { createUser, createAdmin, addTripMember } from '../../../helpers/factories';
import { DatabaseService } from '../../../../src/nest/database/database.service';
import { PermissionsService } from '../../../../src/nest/permissions/permissions.service';
import { TripMembershipService } from '../../../../src/nest/trip-membership/trip-membership.service';
import { TripInviteService } from '../../../../src/nest/trip-invite/trip-invite.service';
import { TripsService } from '../../../../src/nest/trips/trips.service';
import type { MailerService } from '../../../../src/nest/notifications/mailer/mailer.service';
import { BillingService } from '../../../../src/nest/billing/billing.service';
import { TRIP_PAYMENT_REQUIRED, TripPaymentRequiredError, tripCreationNeedsPurchase } from '../../../../src/nest/billing/billing-gate';

const dbs = new DatabaseService(testDb);
// create()／copy() 的收費檢查只用到 dbs；建立行程本身另外只碰 settings（預設幣別）。其餘依賴這裡用不到。
const unused = {} as never;
const trips = new TripsService(dbs, unused, unused, unused, unused, unused, unused, unused, unused, { getUserSettings: () => ({}) } as never);
const invites = new TripInviteService(dbs, new PermissionsService(dbs), new TripMembershipService(dbs));
const billing = new BillingService(dbs, trips, invites, { sendEmail: vi.fn(async () => true) } as unknown as MailerService);

const ENV_KEYS = ['RECUR_SECRET_KEY', 'RECUR_WEBHOOK_SECRET', 'RECUR_PRODUCT_TRIP_ONCE'];
function enableBilling() {
  process.env.RECUR_SECRET_KEY = 'sk_test_unit_dummy';
  process.env.RECUR_WEBHOOK_SECRET = 'whsec_unit_test_only';
  process.env.RECUR_PRODUCT_TRIP_ONCE = 'prod_trip_once_test';
}

beforeAll(() => { createTables(testDb); runMigrations(testDb); });
beforeEach(() => { resetTestDb(testDb); for (const k of ENV_KEYS) delete process.env[k]; });
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
afterAll(() => testDb.close());

describe('開新團的收費檢查', () => {
  it('GATE-001: 收費關閉（金鑰空）→ 誰都照常開團、複製，跟沒有收費功能一樣', () => {
    const { user } = createUser(testDb);
    expect(tripCreationNeedsPurchase(dbs, user.id)).toBe(false);
    const { tripId } = trips.create(user.id, { title: 'A' });
    expect(tripId).toBeGreaterThan(0);
    expect(billing.me(user.id)).toEqual({ needs_purchase: false, free_organizer: false });
  });

  it('GATE-002: 收費開啟 → 一般帳號建立行程拿到 402 TRIP_PAYMENT_REQUIRED，什麼都沒寫進去', () => {
    enableBilling();
    const { user } = createUser(testDb);
    let caught: unknown;
    try { trips.create(user.id, { title: 'A' }); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(TripPaymentRequiredError);
    expect((caught as TripPaymentRequiredError).getStatus()).toBe(402);
    expect((caught as TripPaymentRequiredError).getResponse()).toMatchObject({ code: TRIP_PAYMENT_REQUIRED });
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM trips').get()).toEqual({ n: 0 });
    expect(billing.me(user.id).needs_purchase).toBe(true);
  });

  it('GATE-003: 收費開啟 → 複製行程也算開新團，一樣擋', () => {
    const { user } = createUser(testDb);
    const { tripId } = trips.create(user.id, { title: 'A' });
    enableBilling();
    expect(() => trips.copy(tripId, user.id)).toThrow(TripPaymentRequiredError);
  });

  it('GATE-004: 收費開啟 → 管理員不擋；付款開團（paid）不擋', () => {
    enableBilling();
    const { user: admin } = createAdmin(testDb);
    expect(trips.create(admin.id, { title: 'admin' }).tripId).toBeGreaterThan(0);
    const { user } = createUser(testDb);
    expect(trips.create(user.id, { title: 'paid' }, { paid: true }).tripId).toBeGreaterThan(0);
  });

  it('GATE-005: 免費主揪：管理員用帳號名稱或 Email 指定後就能直接開團；移除後又要付款', () => {
    enableBilling();
    const { user: admin } = createAdmin(testDb);
    const { user } = createUser(testDb, { username: 'tomato', email: 'Tomato@Example.test' });
    expect(billing.addFreeOrganizer(admin.id, 'tomato@example.test', '蕃茄')).toMatchObject({ user_id: user.id, username: 'tomato', note: '蕃茄' });
    expect(billing.addFreeOrganizer(admin.id, 'TOMATO')).toMatchObject({ user_id: user.id });
    expect(billing.listFreeOrganizers()).toHaveLength(1);
    expect(billing.me(user.id)).toEqual({ needs_purchase: false, free_organizer: true });
    expect(trips.create(user.id, { title: 'free' }).tripId).toBeGreaterThan(0);
    expect(billing.removeFreeOrganizer(user.id)).toBe(true);
    expect(billing.removeFreeOrganizer(user.id)).toBe(false);
    expect(() => trips.create(user.id, { title: 'again' })).toThrow(TripPaymentRequiredError);
    expect(billing.addFreeOrganizer(admin.id, 'nobody')).toEqual({ error: 'user_not_found' });
  });
});

describe('現有的沖繩團（行程 id 2）不受收費影響', () => {
  function seedOkinawa() {
    const { user: owner } = createUser(testDb);
    const { user: member } = createUser(testDb);
    testDb.prepare("INSERT INTO trips (id, user_id, title, start_date, end_date) VALUES (2, ?, '沖繩', '2026-12-29', '2027-01-02')").run(owner.id);
    addTripMember(testDb, 2, member.id);
    const before = testDb.prepare('SELECT * FROM trips WHERE id = 2').get();
    return { owner, member, before };
  }

  it('OKI-001: 收費開啟後，擁有者與成員照常看得到、用得到行程 2', () => {
    const { owner, member } = seedOkinawa();
    enableBilling();
    expect(dbs.canAccessTrip(2, owner.id)).toBeTruthy();
    expect(dbs.canAccessTrip(2, member.id)).toBeTruthy();
  });

  it('OKI-002: 收費開啟後，新的人用邀請連結加入行程 2 不收錢、不被擋', () => {
    const { owner } = seedOkinawa();
    const { token } = invites.createOrRotate(2, owner.id, null);
    enableBilling();
    const { user: newcomer } = createUser(testDb);
    expect(tripCreationNeedsPurchase(dbs, newcomer.id)).toBe(true); // 要自己開新團才要付
    const resolved = invites.resolve(token);
    expect(resolved?.trip_id).toBe(2);
    invites.join(2, newcomer.id);
    expect(dbs.canAccessTrip(2, newcomer.id)).toBeTruthy();
  });

  it('OKI-003: 別人的付款、免費優惠碼開團、退款，都不會動到行程 2 與它的邀請連結', async () => {
    const { owner, before } = seedOkinawa();
    const { token } = invites.createOrRotate(2, owner.id, null);
    enableBilling();
    const { user: admin } = createAdmin(testDb);
    billing.createPromo(admin.id, { code: 'FREE100', percent_off: 100 });
    const { user: buyer } = createUser(testDb);
    const res = await billing.startCheckout({ id: buyer.id }, (billing.plan()).consent_ver, 'FREE100');
    expect(res).toMatchObject({ ok: true, url: null });
    expect(testDb.prepare('SELECT * FROM trips WHERE id = 2').get()).toEqual(before);
    expect(invites.get(2)?.token).toBe(token);
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM billing_purchases WHERE trip_id = 2').get()).toEqual({ n: 0 });
  });
});
