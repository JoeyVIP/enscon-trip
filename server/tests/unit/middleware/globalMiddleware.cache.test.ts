import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { applyGlobalMiddleware } from '../../../src/middleware/globalMiddleware';

/**
 * The API default Cache-Control/Vary. A CDN in front of the instance cached
 * /api/auth/me and served the signed-in answer to visitors without a cookie;
 * this is the app-side half of the fix.
 */
function appWith(routes: (app: express.Application) => void): express.Application {
  const app = express();
  applyGlobalMiddleware(app);
  routes(app);
  return app;
}

describe('global API cache policy', () => {
  it('sends private, no-store and Vary: Cookie, Authorization on an /api answer', async () => {
    const app = appWith((a) => a.get('/api/probe', (_req, res) => res.json({ ok: true })));
    const res = await request(app).get('/api/probe');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    const vary = String(res.headers['vary']);
    expect(vary).toContain('Cookie');
    expect(vary).toContain('Authorization');
  });

  it('keeps the Vary entries cors adds instead of replacing them', async () => {
    const app = appWith((a) => a.get('/api/probe', (_req, res) => res.json({ ok: true })));
    const res = await request(app).get('/api/probe').set('Origin', 'http://localhost:5173');
    const vary = String(res.headers['vary']);
    expect(vary).toContain('Origin');
    expect(vary).toContain('Cookie');
    expect(vary).toContain('Authorization');
  });

  it('also covers an error answer', async () => {
    const app = appWith((a) => a.get('/api/missing', (_req, res) => res.status(401).json({ error: 'nope' })));
    const res = await request(app).get('/api/missing');
    expect(res.status).toBe(401);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('lets a route that serves the same bytes to everybody set its own policy', async () => {
    const app = appWith((a) =>
      a.get('/api/static-geo', (_req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.json({ type: 'FeatureCollection', features: [] });
      }),
    );
    const res = await request(app).get('/api/static-geo');
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('leaves non-API paths alone (the SPA and static files keep their own rules)', async () => {
    const app = appWith((a) => a.get('/trips/2', (_req, res) => res.send('page')));
    const res = await request(app).get('/trips/2');
    expect(res.headers['cache-control']).toBeUndefined();
    expect(String(res.headers['vary'] ?? '')).not.toContain('Cookie');
  });
});
