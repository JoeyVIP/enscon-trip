import { describe, it, expect, vi } from 'vitest';
import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TEXT_IMPORT_LLM_RL_MAX, TEXT_IMPORT_RULES_RL_MAX, TextImportController } from '../../../../src/nest/text-import/text-import.controller';
import { TextImportService } from '../../../../src/nest/text-import/text-import.service';
import { textImportRequestSchema } from '../../../../src/nest/text-import/text-import.dto';
import { MAX_TEXT_CHARS } from '../../../../src/nest/text-import/rules';
import { RateLimitService } from '../../../../src/nest/common/rate-limit.service';
import { TripAccessGuard } from '../../../../src/nest/permissions/trip-access.guard';
import type { User } from '../../../../src/types';

const user = { id: 7, role: 'user', email: 'u@example.test' } as User;
const dayDates = ['2026-12-31', '2027-01-01'];

function makeService(key?: string, db = { all: vi.fn().mockReturnValue(dayDates.map(date => ({ date }))) }) {
  const env = { env: () => ({ integrations: { textImportOpenaiKey: key } }) };
  return new TextImportService(db as never, env as never);
}
async function status(p: Promise<unknown>) {
  try { await p; } catch (e) { return (e as HttpException).getStatus(); }
  return 200;
}

describe('TextImportController', () => {
  it('規則可解析時回 source=rules，且不需要金鑰', async () => {
    const c = new TextImportController(makeService(), new RateLimitService());
    const r = (await c.importText(user, '5', { text: '12/31 8點取車、去海邊' })) as { source: string; llmAvailable: boolean; days: { stops: unknown[] }[] };
    expect(r.source).toBe('rules');
    expect(r.llmAvailable).toBe(false);
    expect(r.days[0].stops).toHaveLength(2);
  });

  it('key 未設：要求 AI（useLlm）回 501', async () => {
    const c = new TextImportController(makeService(), new RateLimitService());
    expect(await status(c.importText(user, '5', { text: '12/31 取車', useLlm: true }))).toBe(501);
  });

  it('key 未設且規則解不出：仍回規則結果（未歸類），不是錯誤', async () => {
    const c = new TextImportController(makeService(), new RateLimitService());
    const r = (await c.importText(user, '5', { text: '隨便聊聊' })) as { unassigned: unknown[] };
    expect(r.unassigned).toHaveLength(1);
  });

  it('超長輸入：schema 400；controller 保險 413；上限與前端同為 6000', async () => {
    expect(MAX_TEXT_CHARS).toBe(6000);
    expect(textImportRequestSchema.safeParse({ text: 'a'.repeat(MAX_TEXT_CHARS) }).success).toBe(true);
    expect(textImportRequestSchema.safeParse({ text: 'a'.repeat(MAX_TEXT_CHARS + 1) }).success).toBe(false);
    const c = new TextImportController(makeService(), new RateLimitService());
    expect(await status(c.importText(user, '5', { text: 'a'.repeat(MAX_TEXT_CHARS + 1) }))).toBe(413);
  });

  it('空白輸入 400', async () => {
    const c = new TextImportController(makeService(), new RateLimitService());
    expect(await status(c.importText(user, '5', { text: '   ' }))).toBe(400);
  });

  it('只跑規則的解析：每人每小時 120 次，第 121 次 429；別人不受影響', async () => {
    expect(TEXT_IMPORT_RULES_RL_MAX).toBe(120);
    const c = new TextImportController(makeService(), new RateLimitService());
    for (let i = 0; i < 120; i++) expect(await status(c.importText(user, '5', { text: '12/31 取車' }))).toBe(200);
    expect(await status(c.importText(user, '5', { text: '12/31 取車' }))).toBe(429);
    expect(await status(c.importText({ ...user, id: 8 } as User, '5', { text: '12/31 取車' }))).toBe(200);
  });

  it('規則夠用時不扣 AI 額度：有金鑰也能連續解析超過 10 次，且沒呼叫 AI', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not be called'));
    const c = new TextImportController(makeService('sk-test'), new RateLimitService());
    for (let i = 0; i < 15; i++) expect(await status(c.importText(user, '5', { text: '12/31 取車' }))).toBe(200);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('AI 呼叫每人每小時 10 次：第 11 次按「AI 再解析」429；自動後備改回規則結果、不再呼叫 AI；別人不受影響', async () => {
    expect(TEXT_IMPORT_LLM_RL_MAX).toBe(10);
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('net'));
    const c = new TextImportController(makeService('sk-test'), new RateLimitService());
    for (let i = 0; i < 10; i++) expect(await status(c.importText(user, '5', { text: '12/31 取車', useLlm: true }))).toBe(200);
    expect(spy).toHaveBeenCalledTimes(10);
    expect(await status(c.importText(user, '5', { text: '12/31 取車', useLlm: true }))).toBe(429);
    const auto = (await c.importText(user, '5', { text: '隨便聊聊' })) as { source: string; unassigned: unknown[] };
    expect(auto.source).toBe('rules');
    expect(auto.unassigned).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(10);
    expect(await status(c.importText({ ...user, id: 8 } as User, '5', { text: '12/31 取車', useLlm: true }))).toBe(200);
    expect(spy).toHaveBeenCalledTimes(11);
    spy.mockRestore();
  });

  it('沒金鑰時按 AI 回 501，不扣 AI 額度', async () => {
    const rl = new RateLimitService();
    const c = new TextImportController(makeService(), rl);
    for (let i = 0; i < 12; i++) expect(await status(c.importText(user, '5', { text: '12/31 取車', useLlm: true }))).toBe(501);
    expect(rl.check('text_import_llm', String(user.id), TEXT_IMPORT_LLM_RL_MAX, 60 * 60 * 1000, Date.now())).toBe(true);
  });

  it('有 key 且規則不足時走 LLM；LLM 失敗退回規則結果', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('net'));
    const c = new TextImportController(makeService('sk-test'), new RateLimitService());
    const r = (await c.importText(user, '5', { text: '隨便聊聊' })) as { source: string; llmAvailable: boolean };
    expect(spy).toHaveBeenCalledOnce();
    expect(r.source).toBe('rules');
    expect(r.llmAvailable).toBe(true);
    spy.mockRestore();
  });

  it('LLM 回空結果（一站都沒有）時不蓋掉規則已抓到的站', async () => {
    const empty = new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ days: [], unassigned: [] }) } }] }), { status: 200 });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(empty);
    const c = new TextImportController(makeService('sk-test'), new RateLimitService());
    const r = (await c.importText(user, '5', { text: '去海邊，吃海鮮' })) as { source: string; unassigned: { name: string }[] };
    expect(spy).toHaveBeenCalledOnce();
    expect(r.source).toBe('rules');
    expect(r.unassigned.map(s => s.name)).toEqual(['海邊', '海鮮']);
    spy.mockRestore();
  });

  it('權限：guard 對沒有 day_edit 的使用者回 403，看不到的行程 404', () => {
    const handler = TextImportController.prototype.importText;
    const ctxFor = (): ExecutionContext => ({
      switchToHttp: () => ({ getRequest: () => ({ user, params: { tripId: '5' } }) }),
      getHandler: () => handler,
      getClass: () => TextImportController,
    }) as unknown as ExecutionContext;
    const trip = { id: 5, user_id: 99 };
    const deny = new TripAccessGuard({ canAccessTrip: () => trip } as never, { checkPermission: vi.fn().mockReturnValue(false) } as never, new Reflector());
    expect(() => deny.canActivate(ctxFor())).toThrowError(expect.objectContaining({ status: 403 }));
    const noTrip = new TripAccessGuard({ canAccessTrip: () => undefined } as never, { checkPermission: vi.fn() } as never, new Reflector());
    expect(() => noTrip.canActivate(ctxFor())).toThrowError(expect.objectContaining({ status: 404 }));
    const checkPermission = vi.fn().mockReturnValue(true);
    new TripAccessGuard({ canAccessTrip: () => trip } as never, { checkPermission } as never, new Reflector()).canActivate(ctxFor());
    expect(checkPermission.mock.calls[0][0]).toBe('day_edit');
  });
});
