/**
 * POST /api/admin/trips/:tripId/packing/distribute (ENSCON fork) — the admin
 * hand-out that gives every trip member their own Personal copy of a list.
 *
 * Same harness as packing.e2e.test.ts: the REAL JwtAuthGuard + AdminGuard, the
 * real PackingService SQL over a temp SQLite db, the real AuditService writing
 * to a slim audit_log. Only the WebSocket fan-out is mocked, so the test can
 * read who each created row was pushed to.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { Test } from '@nestjs/testing';
import { seedUser, sessionCookie } from './harness';

const { db } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const tmp = new Database(':memory:');
  tmp.exec('PRAGMA journal_mode = WAL');
  tmp.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'user', password_version INTEGER NOT NULL DEFAULT 0,
    display_name TEXT, avatar TEXT, is_guest INTEGER NOT NULL DEFAULT 0);`);
  tmp.exec('CREATE TABLE trips (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT);');
  tmp.exec('CREATE TABLE trip_members (trip_id INTEGER NOT NULL, user_id INTEGER NOT NULL);');
  tmp.exec(`CREATE TABLE packing_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    checked INTEGER DEFAULT 0,
    category TEXT,
    sort_order INTEGER DEFAULT 0,
    weight_grams INTEGER,
    bag_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_private INTEGER NOT NULL DEFAULT 0,
    owner_id INTEGER,
    updated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  tmp.exec(`CREATE TABLE packing_bags (
    id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1', weight_limit_grams INTEGER, sort_order INTEGER DEFAULT 0,
    user_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
  tmp.exec('CREATE TABLE packing_bag_members (bag_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (bag_id, user_id));');
  tmp.exec('CREATE TABLE packing_item_recipients (item_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (item_id, user_id));');
  tmp.exec(`CREATE TABLE packing_item_contributors (item_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'accepted', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (item_id, user_id));`);
  tmp.exec(`CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER, action TEXT NOT NULL, resource TEXT, details TEXT, ip TEXT);`);
  tmp.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);');
  return { db: tmp };
});

vi.mock('../../src/db/database', () => ({
  db,
  canAccessTrip: (tripId: number | string, userId: number) =>
    db.prepare(`
      SELECT t.id, t.user_id FROM trips t
      LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
      WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)
    `).get(userId, tripId, userId),
  isOwner: () => false,
  getPlaceWithTags: () => null,
  closeDb: () => {},
  reinitialize: () => {},
}));
vi.mock('../../src/websocket', () => ({ broadcast: vi.fn() }));
vi.mock('../../src/nest/audit/audit-log.logger', () => ({ LOG_LEVEL: 'error', logInfo: vi.fn(), logDebug: vi.fn(), logError: vi.fn(), logWarn: vi.fn() }));

import { broadcast } from '../../src/websocket';
import { PermissionsService } from '../../src/nest/permissions/permissions.service';
import { PackingModule } from '../../src/nest/packing/packing.module';
import { AdminPackingDistributeController } from '../../src/nest/packing/admin-packing-distribute.controller';
import { DatabaseModule } from '../../src/nest/database/database.module';
import { RealtimeModule } from '../../src/nest/realtime/realtime.module';
import { TrekExceptionFilter } from '../../src/nest/common/trek-exception.filter';
import { ZodValidationPipe } from '../../src/nest/common/zod-validation.pipe';
import { expectRegisteredController } from '../helpers/module-providers';

const OWNER = 1;
const MEMBER = 2;
const ADMIN = 3; // site admin, not on the trip
const LATE = 4; // joins the trip later
const OUTSIDER = 5; // never on the trip
const GUEST = 6; // a per-trip guest placeholder (#1362), cannot sign in

const SHOPPING = [
  { name: 'Sunscreen', category: 'Shopping' },
  { name: 'Chinsuko', category: 'Shopping', quantity: 3 },
];

const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number }).n;

describe('Admin packing distribute e2e (real auth + admin guard + real SQL)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof build>>;
  let tripId: number;
  const url = () => `/api/admin/trips/${tripId}/packing/distribute`;

  async function build() {
    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule, RealtimeModule, PackingModule] }).compile();
    const nest = moduleRef.createNestApplication();
    nest.use(cookieParser());
    nest.useGlobalFilters(new TrekExceptionFilter());
    nest.useGlobalPipes(new ZodValidationPipe());
    await nest.init();
    return nest;
  }

  beforeAll(async () => {
    seedUser(db as never, { id: OWNER, email: 'owner@example.test' });
    seedUser(db as never, { id: MEMBER, email: 'member@example.test' });
    seedUser(db as never, { id: ADMIN, email: 'admin@example.test', role: 'admin' });
    seedUser(db as never, { id: LATE, email: 'late@example.test' });
    seedUser(db as never, { id: OUTSIDER, email: 'outsider@example.test' });
    seedUser(db as never, { id: GUEST, email: 'guest@example.test' });
    db.prepare('UPDATE users SET is_guest = 1 WHERE id = ?').run(GUEST);
    app = await build();
    vi.spyOn(app.get(PermissionsService), 'checkPermission').mockReturnValue(true);
    server = app.getHttpServer();
  });

  beforeEach(() => {
    vi.mocked(broadcast).mockClear();
    for (const t of ['packing_item_recipients', 'packing_item_contributors', 'packing_items', 'audit_log', 'trip_members', 'trips']) {
      db.exec(`DELETE FROM ${t}`);
    }
    tripId = Number(db.prepare('INSERT INTO trips (user_id, title) VALUES (?, ?)').run(OWNER, 'Okinawa').lastInsertRowid);
    db.prepare('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)').run(tripId, MEMBER);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is registered on PackingModule', () => {
    expectRegisteredController(PackingModule, AdminPackingDistributeController);
  });

  it('401 without a session, writing nothing', async () => {
    const res = await request(server).post(url()).send({ items: SHOPPING });
    expect(res.status).toBe(401);
    expect(count('SELECT COUNT(*) AS n FROM packing_items')).toBe(0);
  });

  it('403 for a trip member and for the trip owner who are not admins, writing nothing', async () => {
    for (const uid of [MEMBER, OWNER]) {
      const res = await request(server).post(url()).set('Cookie', sessionCookie(uid)).send({ items: SHOPPING });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Admin access required' });
    }
    expect(count('SELECT COUNT(*) AS n FROM packing_items')).toBe(0);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('200 for an admin: every member, owner included, gets their own Personal copy', async () => {
    const res = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      members: [
        { user_id: OWNER, created: 2, skipped: 0 },
        { user_id: MEMBER, created: 2, skipped: 0 },
      ],
      created: 4,
      skipped: 0,
    });
    // Counts only — no item names, usernames or emails cross the wire.
    expect(JSON.stringify(res.body)).not.toMatch(/Sunscreen|Chinsuko|example\.test/);

    const rows = db.prepare('SELECT owner_id, is_private, category, name, quantity, checked FROM packing_items ORDER BY owner_id, sort_order').all();
    expect(rows).toEqual([
      { owner_id: OWNER, is_private: 1, category: 'Shopping', name: 'Sunscreen', quantity: 1, checked: 0 },
      { owner_id: OWNER, is_private: 1, category: 'Shopping', name: 'Chinsuko', quantity: 3, checked: 0 },
      { owner_id: MEMBER, is_private: 1, category: 'Shopping', name: 'Sunscreen', quantity: 1, checked: 0 },
      { owner_id: MEMBER, is_private: 1, category: 'Shopping', name: 'Chinsuko', quantity: 3, checked: 0 },
    ]);
    expect(count('SELECT COUNT(*) AS n FROM packing_item_recipients')).toBe(0);
    // The outsider and the admin (not on the trip) get nothing.
    expect(count('SELECT COUNT(*) AS n FROM packing_items WHERE owner_id IN (?, ?)', ADMIN, OUTSIDER)).toBe(0);

    const audit = db.prepare("SELECT user_id, resource, details FROM audit_log WHERE action = 'admin.packing_distribute'").get() as { user_id: number; resource: string; details: string };
    expect(audit).toMatchObject({ user_id: ADMIN, resource: String(tripId) });
    expect(JSON.parse(audit.details)).toEqual({ items: 2, members: 2, created: 4, skipped: 0 });
  });

  it('each member sees only their own copies, and ticking one does not touch anyone else', async () => {
    await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });

    const mine = await request(server).get(`/api/trips/${tripId}/packing`).set('Cookie', sessionCookie(MEMBER));
    expect(mine.status).toBe(200);
    expect(mine.body.items.map((i: { owner_id: number }) => i.owner_id)).toEqual([MEMBER, MEMBER]);

    const sunscreen = mine.body.items.find((i: { name: string }) => i.name === 'Sunscreen');
    const tick = await request(server).put(`/api/trips/${tripId}/packing/${sunscreen.id}`).set('Cookie', sessionCookie(MEMBER)).send({ checked: true });
    expect(tick.status).toBe(200);
    expect(count("SELECT COUNT(*) AS n FROM packing_items WHERE name = 'Sunscreen' AND checked = 1")).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM packing_items WHERE name = 'Sunscreen' AND checked = 1 AND owner_id = ?", MEMBER)).toBe(1);
  });

  it('pushes each created row to its owner only, never to the whole room', async () => {
    await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    const calls = vi.mocked(broadcast).mock.calls.filter(c => c[1] === 'packing:created');
    expect(calls).toHaveLength(4);
    for (const [, , payload, , onlyUserId] of calls) {
      const item = (payload as { item: { owner_id: number } }).item;
      expect(onlyUserId).toBe(item.owner_id);
    }
    expect(calls.map(c => c[4]).sort()).toEqual([OWNER, OWNER, MEMBER, MEMBER]);
  });

  it('running twice leaves the total unchanged and reports everything as skipped', async () => {
    await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    const before = count('SELECT COUNT(*) AS n FROM packing_items');
    vi.mocked(broadcast).mockClear();

    const again = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({
      members: [
        { user_id: OWNER, created: 0, skipped: 2 },
        { user_id: MEMBER, created: 0, skipped: 2 },
      ],
      created: 0,
      skipped: 4,
    });
    expect(count('SELECT COUNT(*) AS n FROM packing_items')).toBe(before);
    expect(vi.mocked(broadcast).mock.calls.filter(c => c[1] === 'packing:created')).toHaveLength(0);
  });

  it('after a new member joins, a re-run adds only their share', async () => {
    await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    const before = count('SELECT COUNT(*) AS n FROM packing_items');
    db.prepare('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)').run(tripId, LATE);

    const res = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    expect(res.status).toBe(200);
    expect(res.body.members).toEqual([
      { user_id: OWNER, created: 0, skipped: 2 },
      { user_id: MEMBER, created: 0, skipped: 2 },
      { user_id: LATE, created: 2, skipped: 0 },
    ]);
    expect(count('SELECT COUNT(*) AS n FROM packing_items')).toBe(before + 2);
    for (const uid of [OWNER, MEMBER, LATE]) {
      expect(count('SELECT COUNT(*) AS n FROM packing_items WHERE owner_id = ?', uid)).toBe(2);
    }
  });

  it('dedupes on (member, category, name): a Common item or another category does not block, an existing Personal one does', async () => {
    // The owner's Common "Sunscreen" (owner_id is stamped on Common creates too).
    db.prepare("INSERT INTO packing_items (trip_id, name, category, is_private, owner_id) VALUES (?, 'Sunscreen', 'Shopping', 0, ?)").run(tripId, OWNER);
    // The member already typed "Sunscreen" into their own list, and has one under another category.
    db.prepare("INSERT INTO packing_items (trip_id, name, category, is_private, owner_id) VALUES (?, 'Sunscreen', 'Shopping', 1, ?)").run(tripId, MEMBER);
    db.prepare("INSERT INTO packing_items (trip_id, name, category, is_private, owner_id) VALUES (?, 'Chinsuko', 'Snacks', 1, ?)").run(tripId, MEMBER);

    const res = await request(server)
      .post(url())
      .set('Cookie', sessionCookie(ADMIN))
      // The duplicate inside the request itself is skipped too.
      .send({ items: [...SHOPPING, { name: ' Sunscreen ', category: 'Shopping' }] });
    expect(res.status).toBe(200);
    expect(res.body.members).toEqual([
      { user_id: OWNER, created: 2, skipped: 1 },
      { user_id: MEMBER, created: 1, skipped: 2 },
    ]);
    expect(count("SELECT COUNT(*) AS n FROM packing_items WHERE owner_id = ? AND is_private = 1 AND name = 'Sunscreen'", MEMBER)).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM packing_items WHERE owner_id = ? AND is_private = 1 AND category = 'Shopping' AND name = 'Chinsuko'", MEMBER)).toBe(1);
  });

  it('a missing category lands in "Other" and dedupes there', async () => {
    const body = { items: [{ name: 'Umbrella' }] };
    const first = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send(body);
    expect(first.body.created).toBe(2);
    const second = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send(body);
    expect(second.body).toMatchObject({ created: 0, skipped: 2 });
    expect(count("SELECT COUNT(*) AS n FROM packing_items WHERE category = 'Other' AND name = 'Umbrella'")).toBe(2);
  });

  it('skips guest members: they can never sign in to see a Personal item', async () => {
    db.prepare('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)').run(tripId, GUEST);
    const res = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { user_id: number }) => m.user_id)).toEqual([OWNER, MEMBER]);
    expect(count('SELECT COUNT(*) AS n FROM packing_items WHERE owner_id = ?', GUEST)).toBe(0);
  });

  it('404 for a trip that does not exist', async () => {
    const res = await request(server).post('/api/admin/trips/99999/packing/distribute').set('Cookie', sessionCookie(ADMIN)).send({ items: SHOPPING });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Trip not found' });
    expect(count('SELECT COUNT(*) AS n FROM packing_items')).toBe(0);
  });

  it('400 for an empty list or a blank name, writing nothing', async () => {
    for (const body of [{ items: [] }, { items: [{ name: '  ' }] }, {}]) {
      const res = await request(server).post(url()).set('Cookie', sessionCookie(ADMIN)).send(body);
      expect(res.status).toBe(400);
    }
    expect(count('SELECT COUNT(*) AS n FROM packing_items')).toBe(0);
  });
});
