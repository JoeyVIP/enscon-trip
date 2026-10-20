import { runMigrations } from '../../../src/db/migrations';
import { createTables } from '../../../src/db/schema';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// ENSCON 按趟收費的兩張表：只新增、不動既有資料、可重複執行；付款紀錄不跟著帳號或行程被刪。
const tables = (db: Database.Database) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'billing_%'").all() as { name: string }[]).map((t) => t.name).sort();

describe('billing tables migration', () => {
  let db: Database.Database;
  afterEach(() => db?.close());

  function fresh() {
    db = new Database(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    createTables(db);
    runMigrations(db);
    return (db.prepare('SELECT version FROM schema_version').get() as { version: number }).version;
  }

  it('新資料庫有四張 billing_ 表', () => {
    fresh();
    expect(tables(db)).toEqual(['billing_events', 'billing_free_organizers', 'billing_promo_codes', 'billing_purchases']);
  });

  it('從上一版升級：既有行程原封不動，新表建好，版本 +1', () => {
    const version = fresh();
    for (const t of ['billing_events', 'billing_purchases', 'billing_free_organizers', 'billing_promo_codes']) db.exec(`DROP TABLE ${t}`);
    db.exec("INSERT INTO users (username, email, password_hash) VALUES ('u', 'u@example.test', 'x')");
    db.exec("INSERT INTO trips (user_id, title) VALUES (1, '舊行程')");
    db.prepare('UPDATE schema_version SET version = ?').run(version - 1);
    runMigrations(db);
    expect(tables(db)).toEqual(['billing_events', 'billing_free_organizers', 'billing_promo_codes', 'billing_purchases']);
    expect(db.prepare('SELECT title FROM trips').get()).toEqual({ title: '舊行程' });
    expect((db.prepare('SELECT version FROM schema_version').get() as { version: number }).version).toBe(version);
  });

  it('重複執行不會出錯', () => {
    const version = fresh();
    db.prepare('UPDATE schema_version SET version = ?').run(version - 1);
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('刪帳號、刪行程不會刪掉付款紀錄（SET NULL），同一張訂單只能有一列', () => {
    fresh();
    db.exec("INSERT INTO users (username, email, password_hash) VALUES ('u', 'u@example.test', 'x')");
    db.exec("INSERT INTO trips (user_id, title) VALUES (1, 'T')");
    db.exec(`INSERT INTO billing_purchases (ref, user_id, checkout_id, order_id, product_id, seats, trip_id, consent_at, consent_ver)
             VALUES ('r1', 1, 'cs_1', 'ord_1', 'p', 10, 1, '2026-10-20T00:00:00Z', 'v')`);
    expect(() => db.exec(`INSERT INTO billing_purchases (ref, user_id, order_id, product_id, seats, consent_at, consent_ver)
             VALUES ('r2', 1, 'ord_1', 'p', 10, '2026-10-20T00:00:00Z', 'v')`)).toThrow();
    db.exec('DELETE FROM trips WHERE id = 1');
    db.exec('DELETE FROM users WHERE id = 1');
    expect(db.prepare('SELECT ref, user_id, trip_id, invoice_status, status FROM billing_purchases').get())
      .toEqual({ ref: 'r1', user_id: null, trip_id: null, invoice_status: 'none', status: 'pending' });
  });

  it('優惠碼大小寫不分、折抵只能 1–100%；刪帳號時免費主揪那一列跟著刪', () => {
    fresh();
    db.exec("INSERT INTO users (username, email, password_hash) VALUES ('u', 'u@example.test', 'x')");
    db.exec("INSERT INTO billing_promo_codes (code, percent_off) VALUES ('FREE100', 100)");
    expect(() => db.exec("INSERT INTO billing_promo_codes (code, percent_off) VALUES ('free100', 50)")).toThrow();
    expect(() => db.exec("INSERT INTO billing_promo_codes (code, percent_off) VALUES ('X', 0)")).toThrow();
    expect(() => db.exec("INSERT INTO billing_promo_codes (code, percent_off) VALUES ('Y', 101)")).toThrow();
    db.exec('INSERT INTO billing_free_organizers (user_id) VALUES (1)');
    db.exec('DELETE FROM users WHERE id = 1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM billing_free_organizers').get()).toEqual({ n: 0 });
  });
});
