import { runMigrations } from '../../../src/db/migrations';
import { createTables } from '../../../src/db/schema';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// 伴手禮欄位 migration：只 ADD COLUMN，不動既有資料，可重複執行。
const cols = (db: Database.Database) =>
  (db.prepare("SELECT name FROM pragma_table_info('todo_items')").all() as { name: string }[]).map(c => c.name);

describe('todo_items 伴手禮欄位 migration', () => {
  let db: Database.Database;
  afterEach(() => db?.close());

  it('新資料庫有五個新欄位', () => {
    db = new Database(':memory:');
    createTables(db);
    runMigrations(db);
    expect(cols(db)).toEqual(expect.arrayContaining(['kind', 'quantity', 'recipient', 'store', 'price_jpy']));
  });

  it('升級舊資料庫：既有待辦原封不動，quantity 預設 1，其餘為 NULL', () => {
    db = new Database(':memory:');
    createTables(db);
    runMigrations(db);
    const { version } = db.prepare('SELECT version FROM schema_version').get() as { version: number };

    // 模擬升級前：還原成沒有新欄位的舊表（只在測試的 :memory: 資料庫做）
    db.exec('ALTER TABLE todo_items DROP COLUMN kind');
    db.exec('ALTER TABLE todo_items DROP COLUMN quantity');
    db.exec('ALTER TABLE todo_items DROP COLUMN recipient');
    db.exec('ALTER TABLE todo_items DROP COLUMN store');
    db.exec('ALTER TABLE todo_items DROP COLUMN price_jpy');
    db.exec("INSERT INTO users (username, email, password_hash) VALUES ('u', 'u@example.test', 'x')");
    db.exec("INSERT INTO trips (user_id, title) VALUES (1, 'T')");
    db.exec("INSERT INTO todo_items (trip_id, name, checked, category) VALUES (1, '訂飯店', 1, '行前')");

    db.prepare('UPDATE schema_version SET version = ?').run(version - 1);
    runMigrations(db);

    expect(db.prepare('SELECT name, checked, category, kind, quantity, recipient, store, price_jpy FROM todo_items').get()).toEqual({
      name: '訂飯店', checked: 1, category: '行前', kind: null, quantity: 1, recipient: null, store: null, price_jpy: null,
    });
    expect((db.prepare('SELECT version FROM schema_version').get() as { version: number }).version).toBe(version);
  });

  it('重複執行不會出錯', () => {
    db = new Database(':memory:');
    createTables(db);
    runMigrations(db);
    const { version } = db.prepare('SELECT version FROM schema_version').get() as { version: number };
    db.prepare('UPDATE schema_version SET version = ?').run(version - 1);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
