import { describe, it, expect, vi } from 'vitest';

// ENSCON fork：沒有任何已存語言時，最後的 fallback 是 zh-TW（上游是 en）。
// tests/setup.ts 為了讓既有英文斷言不壞，會先寫 app_language=en，這裡清掉後重新載入 store 模組。
describe('settingsStore default language (ENSCON)', () => {
  it('FE-STORE-SETTINGS-ENSCON-001: falls back to zh-TW when nothing is stored', async () => {
    localStorage.clear();
    vi.resetModules();
    const { useSettingsStore } = await import('../../../src/store/settingsStore');
    expect(useSettingsStore.getState().settings.language).toBe('zh-TW');
  });

  it('FE-STORE-SETTINGS-ENSCON-002: an explicit stored choice still wins', async () => {
    localStorage.clear();
    localStorage.setItem('app_language', 'ja');
    vi.resetModules();
    const { useSettingsStore } = await import('../../../src/store/settingsStore');
    expect(useSettingsStore.getState().settings.language).toBe('ja');
  });
});
