// FE-INVITE-STORE-001 to FE-INVITE-STORE-008
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveInvite, loadInvite, clearInvite, INVITE_STORAGE_KEY, INVITE_LS_TTL_MS } from './inviteStore';

function wipeCookie() {
  document.cookie = 'enscon_invite=; Max-Age=0; Path=/';
}

describe('inviteStore', () => {
  beforeEach(() => { localStorage.clear(); wipeCookie(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); wipeCookie(); });

  it('FE-INVITE-STORE-001: saveInvite 同時寫 localStorage（含時間戳）與 cookie', () => {
    saveInvite('abcdEFGH1234');
    const stored = JSON.parse(localStorage.getItem(INVITE_STORAGE_KEY)!);
    expect(stored.v).toBe('abcdEFGH1234');
    expect(typeof stored.t).toBe('number');
    expect(document.cookie).toContain('enscon_invite=abcdEFGH1234');
    expect(loadInvite()).toBe('abcdEFGH1234');
  });

  it('FE-INVITE-STORE-002: 格式不對的值不存', () => {
    saveInvite('short');
    saveInvite('bad value with spaces!');
    expect(localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull();
    expect(loadInvite()).toBe('');
  });

  it('FE-INVITE-STORE-003: localStorage 超過 30 分鐘失效', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T10:00:00+08:00'));
    saveInvite('abcdEFGH1234');
    wipeCookie();
    vi.setSystemTime(Date.now() + INVITE_LS_TTL_MS - 1000);
    expect(loadInvite()).toBe('abcdEFGH1234');
    vi.setSystemTime(Date.now() + 2000);
    expect(loadInvite()).toBe('');
  });

  it('FE-INVITE-STORE-004: localStorage 沒有時退回 cookie', () => {
    saveInvite('abcdEFGH1234');
    localStorage.clear();
    expect(loadInvite()).toBe('abcdEFGH1234');
  });

  it('FE-INVITE-STORE-005: clearInvite 兩處都清掉', () => {
    saveInvite('abcdEFGH1234');
    clearInvite();
    expect(localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain('enscon_invite');
    expect(loadInvite()).toBe('');
  });

  it('FE-INVITE-STORE-006: localStorage 內容壞掉不丟錯', () => {
    localStorage.setItem(INVITE_STORAGE_KEY, '{not json');
    expect(loadInvite()).toBe('');
  });

  it('FE-INVITE-STORE-007: 讀得懂舊版前端存的純字串（sha-a818980 之前的格式），並改寫成新格式', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T11:10:00+08:00'));
    localStorage.setItem(INVITE_STORAGE_KEY, '3de66a7c9839d43960db5cb5717ad779');
    expect(loadInvite()).toBe('3de66a7c9839d43960db5cb5717ad779');
    const migrated = JSON.parse(localStorage.getItem(INVITE_STORAGE_KEY)!);
    expect(migrated).toEqual({ v: '3de66a7c9839d43960db5cb5717ad779', t: Date.now() });
    // 改寫後照新格式的 30 分鐘過期，舊值不會永遠留著
    vi.setSystemTime(Date.now() + INVITE_LS_TTL_MS + 1000);
    expect(loadInvite()).toBe('');
  });

  it('FE-INVITE-STORE-008: 舊格式但內容不像邀請碼就不理', () => {
    localStorage.setItem(INVITE_STORAGE_KEY, 'bad value!');
    expect(loadInvite()).toBe('');
    localStorage.setItem(INVITE_STORAGE_KEY, '12345678');
    // 全數字也符合邀請碼格式（舊版就是這樣檢查的），照樣當邀請碼
    expect(loadInvite()).toBe('12345678');
  });
});
