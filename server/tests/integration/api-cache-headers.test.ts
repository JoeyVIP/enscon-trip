/**
 * API cache headers through the real bootstrap (buildApp).
 *
 * A Cloudflare rule in front of the instance cached /api/auth/me, /api/trips/:id
 * and /api/trips/:id/budget and served the signed-in answers to visitors with no
 * cookie (cf-cache-status: HIT). The CDN rule is fixed at the CDN; this suite pins
 * the app-side half: every one of those answers says private + no-store and
 * varies on Cookie/Authorization, so no shared cache may keep it.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import type { INestApplication } from '@nestjs/common';

const { testDb, dbMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    canAccessTrip: (tripId: any, userId: number) =>
      db
        .prepare(
          `SELECT t.id, t.user_id FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ? WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)`,
        )
        .get(userId, tripId, userId),
    isOwner: (tripId: any, userId: number) => !!db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId),
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../src/db/database', () => dbMock);
vi.mock('../../src/config', () => ({
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
  SESSION_DURATION: '24h',
  SESSION_DURATION_MS: 86400000,
  SESSION_DURATION_SECONDS: 86400,
  DEFAULT_LANGUAGE: 'en',
}));
vi.mock('../../src/websocket', () => ({ broadcast: vi.fn(), broadcastToUser: vi.fn() }));

import { buildApp } from '../../src/bootstrap';
import { createTables } from '../../src/db/schema';
import { runMigrations } from '../../src/db/migrations';
import { resetTestDb, resetRateLimits } from '../helpers/test-db';
import { createUser, createTrip, createBudgetItem } from '../helpers/factories';
import { authCookie, authHeader } from '../helpers/auth';

let nestApp: INestApplication;
let app: Application;

beforeAll(async () => {
  createTables(testDb);
  runMigrations(testDb);
  nestApp = await buildApp();
  app = nestApp.getHttpAdapter().getInstance();
});

beforeEach(() => {
  resetTestDb(testDb);
  resetRateLimits(nestApp);
});

afterAll(async () => {
  await nestApp.close();
  testDb.close();
});

function expectNotCacheable(res: request.Response): void {
  const cacheControl = String(res.headers['cache-control'] ?? '');
  expect(cacheControl).toContain('private');
  expect(cacheControl).toContain('no-store');
  expect(cacheControl).not.toContain('public');
  const vary = String(res.headers['vary'] ?? '');
  expect(vary).toContain('Cookie');
  expect(vary).toContain('Authorization');
}

describe('API-CACHE — signed-in answers are never cacheable by a CDN', () => {
  it('API-CACHE-001 — GET /api/auth/me (cookie session)', async () => {
    const { user } = createUser(testDb);
    const res = await request(app).get('/api/auth/me').set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expectNotCacheable(res);
  });

  it('API-CACHE-002 — GET /api/auth/me (Authorization header)', async () => {
    const { user } = createUser(testDb);
    const res = await request(app).get('/api/auth/me').set(authHeader(user.id));
    expect(res.status).toBe(200);
    expectNotCacheable(res);
  });

  it('API-CACHE-003 — GET /api/auth/me without a session (the answer a CDN would store for everybody)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expectNotCacheable(res);
  });

  it('API-CACHE-004 — GET /api/trips/:id', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const res = await request(app).get(`/api/trips/${trip.id}`).set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expectNotCacheable(res);
  });

  it('API-CACHE-005 — GET /api/trips/:id/budget', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    createBudgetItem(testDb, trip.id, { name: 'Hotel', total_price: 500 });
    const res = await request(app).get(`/api/trips/${trip.id}/budget`).set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expectNotCacheable(res);
  });

  it('API-CACHE-006 — the anonymous answers for a trip and its budget are not cacheable either', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    for (const path of [`/api/trips/${trip.id}`, `/api/trips/${trip.id}/budget`]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expectNotCacheable(res);
    }
  });

  it('API-CACHE-007 — GET /api/shared/:token (revocable share link) is not cacheable', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const created = await request(app).post(`/api/trips/${trip.id}/share-link`).set('Cookie', authCookie(user.id)).send({});
    expect([200, 201]).toContain(created.status);
    const res = await request(app).get(`/api/shared/${created.body.token}`);
    expect(res.status).toBe(200);
    expectNotCacheable(res);
  });

  it('API-CACHE-008 — the bundled country GeoJSON keeps its deliberate public day-long cache', async () => {
    const { user } = createUser(testDb);
    const res = await request(app).get('/api/addons/atlas/countries/geo').set('Cookie', authCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });
});
