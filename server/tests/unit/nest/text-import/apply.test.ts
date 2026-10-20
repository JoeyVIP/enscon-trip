import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../../../src/nest/database/database.service';
import { TextImportApplyService, type ApplyStop } from '../../../../src/nest/text-import/text-import-apply.service';
import { TextImportApplyController } from '../../../../src/nest/text-import/text-import-apply.controller';
import { textImportApplySchema } from '../../../../src/nest/text-import/text-import.dto';
import { TripAccessGuard } from '../../../../src/nest/permissions/trip-access.guard';
import type { User } from '../../../../src/types';

const user = { id: 7, role: 'user', email: 'u@example.test' } as User;
const trip = { id: 5, user_id: 7 } as never;
const stops: ApplyStop[] = [
  { dayId: 11, name: '取車', time: '08:00' },
  { dayId: 11, name: '美麗海水族館', note: '要預約' },
  { dayId: 12, name: '國際通' },
];

/**
 * 真的 better-sqlite3（記憶體）：places.create / createAssignment 的替身寫進同一個連線，
 * createAssignment 跟正式版一樣自己再包一層 transaction（巢狀＝savepoint），
 * 用來驗證中途失敗時整批回滾、一筆都不留。
 */
function setup(opts: { failOnAssignment?: number; canEditPlaces?: boolean; days?: number[] } = {}) {
  const conn = new Database(':memory:');
  conn.exec('CREATE TABLE places (id INTEGER PRIMARY KEY, trip_id INTEGER, name TEXT, place_time TEXT, notes TEXT);'
    + 'CREATE TABLE day_assignments (id INTEGER PRIMARY KEY, day_id INTEGER, place_id INTEGER);');
  const db = new DatabaseService(conn);
  const order: string[] = [];
  let n = 0;
  const places = {
    canEdit: vi.fn(() => opts.canEditPlaces ?? true),
    create: vi.fn((tripId: string, b: { name: string; place_time?: string; notes?: string }) => {
      const r = db.run('INSERT INTO places (trip_id, name, place_time, notes) VALUES (?, ?, ?, ?)', tripId, b.name, b.place_time || null, b.notes || null);
      order.push(`create:${b.name}`);
      return { id: Number(r.lastInsertRowid), name: b.name };
    }),
    broadcast: vi.fn((_t: string, event: string) => { order.push(event); }),
    onCreated: vi.fn(),
  };
  const assignments = {
    dayExists: vi.fn((dayId: number) => (opts.days ?? [11, 12]).includes(dayId)),
    createAssignment: vi.fn((dayId: number, placeId: number) => db.transaction(() => {
      n++;
      if (opts.failOnAssignment === n) throw new Error('disk I/O error');
      const r = db.run('INSERT INTO day_assignments (day_id, place_id) VALUES (?, ?)', dayId, placeId);
      return { id: Number(r.lastInsertRowid), day_id: dayId, place_id: placeId };
    })),
    broadcast: vi.fn((_t: string, event: string) => { order.push(event); }),
    reconcile: vi.fn(() => { order.push('reconcile'); }),
  };
  const svc = new TextImportApplyService(db, places as never, assignments as never);
  const count = (table: string) => (conn.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
  return { svc, places, assignments, count, order };
}

function status(fn: () => unknown) {
  try { fn(); } catch (e) { return (e as HttpException).getStatus(); }
  return 200;
}

describe('TextImportApplyService（加入行程：全成功或全不建）', () => {
  it('全部成功：依序建 place + assignment，commit 後才廣播，reconcile 只跑一次', () => {
    const { svc, places, assignments, count, order } = setup();
    expect(svc.apply(trip, user, '5', stops, 'sock-1')).toEqual({ added: 3 });
    expect(count('places')).toBe(3);
    expect(count('day_assignments')).toBe(3);
    expect(places.create.mock.calls.map(c => c[1].name)).toEqual(['取車', '美麗海水族館', '國際通']);
    expect(places.create).toHaveBeenCalledWith('5', { name: '取車', place_time: '08:00', notes: undefined });
    expect(assignments.createAssignment.mock.calls.map(c => c[0])).toEqual([11, 11, 12]);
    // 所有寫入在任何廣播之前（廣播在 transaction 外）
    expect(order.slice(0, 3)).toEqual(['create:取車', 'create:美麗海水族館', 'create:國際通']);
    expect(order.filter(e => e === 'place:created')).toHaveLength(3);
    expect(order.filter(e => e === 'assignment:created')).toHaveLength(3);
    expect(order[order.length - 1]).toBe('reconcile');
    expect(assignments.reconcile).toHaveBeenCalledOnce();
    expect(places.broadcast).toHaveBeenCalledWith('5', 'place:created', { place: { id: 1, name: '取車' } }, 'sock-1');
    expect(assignments.broadcast).toHaveBeenCalledWith('5', 'assignment:created', { assignment: { id: 1, day_id: 11, place_id: 1 } }, 'sock-1');
    expect(places.onCreated).toHaveBeenCalledTimes(3);
  });

  it('中途失敗（第 3 站的 assignment）：整批回滾，DB 一筆不留、不廣播，回 500', () => {
    const { svc, places, assignments, count } = setup({ failOnAssignment: 3 });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(status(() => svc.apply(trip, user, '5', stops))).toBe(500);
    // 有留一行給維運，但不含站名／備註
    expect(logged).toHaveBeenCalledOnce();
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/取車|美麗海|國際通|要預約/);
    logged.mockRestore();
    expect(places.create).toHaveBeenCalledTimes(3);
    expect(count('places')).toBe(0);
    expect(count('day_assignments')).toBe(0);
    expect(places.broadcast).not.toHaveBeenCalled();
    expect(assignments.broadcast).not.toHaveBeenCalled();
    expect(assignments.reconcile).not.toHaveBeenCalled();
  });

  it('沒有 place_edit：403，不寫入', () => {
    const { svc, places, count } = setup({ canEditPlaces: false });
    expect(status(() => svc.apply(trip, user, '5', stops))).toBe(403);
    expect(places.create).not.toHaveBeenCalled();
    expect(count('places')).toBe(0);
  });

  it('任何一個 dayId 不屬於這個行程：404，一站都不建', () => {
    const { svc, places, assignments, count } = setup({ days: [11] });
    expect(status(() => svc.apply(trip, user, '5', stops))).toBe(404);
    expect(places.create).not.toHaveBeenCalled();
    expect(assignments.dayExists).toHaveBeenCalledWith(12, '5');
    expect(count('places')).toBe(0);
  });
});

describe('textImportApplySchema', () => {
  it('接受合格站點，名稱會 trim', () => {
    const r = textImportApplySchema.parse({ stops: [{ dayId: 1, name: '  取車 ', time: '08:00' }] });
    expect(r.stops[0].name).toBe('取車');
  });

  it('擋空清單、空名稱、超長名稱、錯誤時間、非正整數 dayId、超過 200 站', () => {
    const bad = [
      { stops: [] },
      { stops: [{ dayId: 1, name: '   ' }] },
      { stops: [{ dayId: 1, name: 'a'.repeat(201) }] },
      { stops: [{ dayId: 1, name: 'x', time: '25:00' }] },
      { stops: [{ dayId: 0, name: 'x' }] },
      { stops: [{ dayId: 1.5, name: 'x' }] },
      { stops: Array.from({ length: 201 }, () => ({ dayId: 1, name: 'x' })) },
    ];
    for (const b of bad) expect(textImportApplySchema.safeParse(b).success).toBe(false);
  });
});

describe('TextImportApplyController 權限', () => {
  it('guard 與 import-text 相同：要 day_edit，沒權限 403、看不到的行程 404', () => {
    const handler = TextImportApplyController.prototype.apply;
    const ctxFor = (): ExecutionContext => ({
      switchToHttp: () => ({ getRequest: () => ({ user, params: { tripId: '5' } }) }),
      getHandler: () => handler,
      getClass: () => TextImportApplyController,
    }) as unknown as ExecutionContext;
    const t = { id: 5, user_id: 99 };
    const deny = new TripAccessGuard({ canAccessTrip: () => t } as never, { checkPermission: vi.fn().mockReturnValue(false) } as never, new Reflector());
    expect(() => deny.canActivate(ctxFor())).toThrowError(expect.objectContaining({ status: 403 }));
    const noTrip = new TripAccessGuard({ canAccessTrip: () => undefined } as never, { checkPermission: vi.fn() } as never, new Reflector());
    expect(() => noTrip.canActivate(ctxFor())).toThrowError(expect.objectContaining({ status: 404 }));
    const checkPermission = vi.fn().mockReturnValue(true);
    new TripAccessGuard({ canAccessTrip: () => t } as never, { checkPermission } as never, new Reflector()).canActivate(ctxFor());
    expect(checkPermission.mock.calls[0][0]).toBe('day_edit');
  });
});
