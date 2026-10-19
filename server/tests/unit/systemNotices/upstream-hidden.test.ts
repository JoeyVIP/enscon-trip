// ENSCON：上游作者的第一人稱／募款通知預設不顯示（SHOW_UPSTREAM_NOTICES 沒設或不是 'true'）
import { describe, it, expect, afterEach } from 'vitest';
import { SYSTEM_NOTICES } from '../../../src/systemNotices/registry.js';
import { evaluate } from '../../../src/systemNotices/conditions.js';

const ctx = {
  user: { login_count: 5, first_seen_version: '4.0.0', role: 'user', noTrips: 1 },
  currentAppVersion: '4.3.3',
  now: new Date('2026-10-20T00:00:00Z'),
  addonEnabled: () => true,
  managed: false,
};
const UPSTREAM = ['release-notes', 'thank-you-support'];
const saved = process.env.SHOW_UPSTREAM_NOTICES;

describe('上游通知預設隱藏（ENSCON-NOTICE）', () => {
  afterEach(() => {
    if (saved === undefined) delete process.env.SHOW_UPSTREAM_NOTICES;
    else process.env.SHOW_UPSTREAM_NOTICES = saved;
  });

  it('ENSCON-NOTICE-001: 沒設 SHOW_UPSTREAM_NOTICES 時，兩則上游通知條件不通過', () => {
    delete process.env.SHOW_UPSTREAM_NOTICES;
    for (const id of UPSTREAM) {
      const n = SYSTEM_NOTICES.find(x => x.id === id)!;
      expect(n, id).toBeDefined();
      expect(evaluate(n, ctx), id).toBe(false);
    }
  });

  it('ENSCON-NOTICE-002: 設成 "false" 或其他值也一樣隱藏', () => {
    for (const v of ['false', '0', '']) {
      process.env.SHOW_UPSTREAM_NOTICES = v;
      for (const id of UPSTREAM) expect(evaluate(SYSTEM_NOTICES.find(x => x.id === id)!, ctx), `${id}@${v}`).toBe(false);
    }
  });

  it('ENSCON-NOTICE-003: 明確設成 "true" 才通過（上游行為可以選擇打開）', () => {
    process.env.SHOW_UPSTREAM_NOTICES = 'true';
    expect(evaluate(SYSTEM_NOTICES.find(x => x.id === 'release-notes')!, ctx)).toBe(true);
  });
});
