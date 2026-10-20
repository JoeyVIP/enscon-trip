import ar from './ar';
import br from './br';
import ca from './ca';
import cs from './cs';
import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import gr from './gr';
import hu from './hu';
import id from './id';
import itIT from './it';
import ja from './ja';
import ko from './ko';
import nl from './nl';
import pl from './pl';
import ru from './ru';
import sv from './sv';
import tr from './tr';
import type { TranslationStrings } from './types';
import uk from './uk';
import vi from './vi';
import zh from './zh';
import zhTW from './zh-TW';

import { describe, it, expect } from 'vitest';

/**
 * twNav: the short captions under the phone dock icons and the Collab tab name.
 * Every locale ships every key (the dock would otherwise print a raw key),
 * the two Chinese locales say it in Chinese, and every other locale keeps
 * its own word for Collab instead of falling back to the English one.
 */
const LOCALES: Record<string, TranslationStrings> = {
  ar,
  br,
  ca,
  cs,
  de,
  en,
  es,
  fr,
  gr,
  hu,
  id,
  it: itIT,
  ja,
  ko,
  nl,
  pl,
  ru,
  sv,
  tr,
  uk,
  vi,
  zh,
  'zh-TW': zhTW,
};

const KEYS = [
  'twNav.dock.plan',
  'twNav.dock.roadtrip',
  'twNav.dock.transports',
  'twNav.dock.bookings',
  'twNav.dock.budget',
  'twNav.dock.lists',
  'twNav.collab',
];

const HAN = /\p{Script=Han}/u;

describe('twNav i18n', () => {
  it('I18N-TWNAV-001: every locale has every twNav key with a non-empty value', () => {
    for (const [code, strings] of Object.entries(LOCALES)) {
      for (const key of KEYS) {
        expect(typeof strings[key], `${code} ${key}`).toBe('string');
        expect((strings[key] as string).trim().length, `${code} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('I18N-TWNAV-002: zh-TW and zh read in Chinese, and Collab is no longer the English word', () => {
    for (const code of ['zh-TW', 'zh']) {
      for (const key of KEYS) expect(LOCALES[code][key], `${code} ${key}`).toMatch(HAN);
    }
    expect(zhTW['twNav.collab']).toBe('筆記與聊天');
    expect(zhTW['twNav.dock.budget']).toBe('費用');
  });

  it('I18N-TWNAV-003: dock captions stay short enough for a 48px seat', () => {
    for (const [code, strings] of Object.entries(LOCALES)) {
      for (const key of KEYS.filter((k) => k.startsWith('twNav.dock.'))) {
        const max = HAN.test(strings[key] as string) ? 2 : 8;
        expect([...(strings[key] as string)].length, `${code} ${key}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('I18N-TWNAV-004: other locales keep their own collab addon name', () => {
    for (const [code, strings] of Object.entries(LOCALES)) {
      if (code === 'zh' || code === 'zh-TW') continue;
      expect(strings['twNav.collab'], code).toBe(strings['admin.addons.catalog.collab.name']);
    }
  });
});
