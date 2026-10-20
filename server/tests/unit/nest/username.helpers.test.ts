/**
 * Username rules shared by OIDC sign-up and the self-service rename
 * (src/nest/auth/username.helpers.ts). Pure functions, no DB.
 */
import { describe, it, expect } from 'vitest';
import {
  AUTO_FALLBACK_USERNAME,
  USERNAME_MAX_LENGTH,
  normalizeUsernameInput,
  sanitizeUsernameFromClaim,
  usernameValidationError,
} from '../../../src/nest/auth/username.helpers';

describe('sanitizeUsernameFromClaim', () => {
  it('USERNAME-001: keeps a Chinese LINE display name as-is', () => {
    expect(sanitizeUsernameFromClaim('王小明')).toBe('王小明');
  });

  it('USERNAME-002: drops emoji mixed into a name and closes the gap they leave', () => {
    expect(sanitizeUsernameFromClaim('🍅蕃茄🍅')).toBe('蕃茄');
    expect(sanitizeUsernameFromClaim('Joey 🎉 Wang')).toBe('Joey Wang');
  });

  it('USERNAME-003: an all-emoji name sanitises to nothing (caller falls back to "user")', () => {
    expect(sanitizeUsernameFromClaim('🍅🎉✨')).toBe('');
    expect(sanitizeUsernameFromClaim('🍅🎉✨') || 'user').toBe('user');
  });

  it('USERNAME-004: keeps one space between words of an English name, trims the ends', () => {
    expect(sanitizeUsernameFromClaim('  Joey   Wang  ')).toBe('Joey Wang');
    expect(sanitizeUsernameFromClaim('Joey\tWang\nJr')).toBe('Joey Wang Jr');
    // NBSP and the ideographic space become a plain space.
    expect(sanitizeUsernameFromClaim('Joey Wang')).toBe('Joey Wang');
    expect(sanitizeUsernameFromClaim('王　小明')).toBe('王 小明');
  });

  it('USERNAME-005: keeps the characters the old ASCII rule allowed', () => {
    expect(sanitizeUsernameFromClaim('first.last_1-2')).toBe('first.last_1-2');
  });

  it('USERNAME-006: NFKC folds full-width letters onto ASCII', () => {
    expect(sanitizeUsernameFromClaim('Ｊｏｅｙ')).toBe('Joey');
  });

  it('USERNAME-007: strips control, zero-width and bidi characters', () => {
    const sneaky = [
      'a\u0000b', // C0 control
      'a​b', 'a‌b', 'a‍b', 'a‎b', 'a‏b', // zero-width / marks
      'a‪b', 'a‫b', 'a‬b', 'a‭b', 'a‮b', // bidi embed/override
      'a⁦b', 'a⁧b', 'a⁨b', 'a⁩b', // bidi isolates
      'a﻿b', // BOM
    ];
    for (const raw of sneaky) expect(sanitizeUsernameFromClaim(raw)).toBe('ab');
  });

  it('USERNAME-008: strips @, slashes, angle brackets and quotes', () => {
    expect(sanitizeUsernameFromClaim('@admin')).toBe('admin');
    expect(sanitizeUsernameFromClaim('../etc/passwd')).toBe('..etcpasswd');
    expect(sanitizeUsernameFromClaim('a\\b')).toBe('ab');
    expect(sanitizeUsernameFromClaim('<script>alert("x")</script>')).toBe('scriptalertxscript');
    expect(sanitizeUsernameFromClaim(`O'Brien \`x\``)).toBe('OBrien x');
  });

  it('USERNAME-009: drops Cyrillic/Greek look-alikes mixed into a Latin name', () => {
    // "pаypal" with a Cyrillic а (U+0430)
    expect(sanitizeUsernameFromClaim('pаypal')).toBe('pypal');
    // A name entirely in Cyrillic is a real name and stays.
    expect(sanitizeUsernameFromClaim('Иван')).toBe('Иван');
  });

  it('USERNAME-010: caps at 30 code points and never ends on a space', () => {
    expect(sanitizeUsernameFromClaim('a'.repeat(40))).toHaveLength(USERNAME_MAX_LENGTH);
    expect([...sanitizeUsernameFromClaim('漢'.repeat(40))]).toHaveLength(USERNAME_MAX_LENGTH);
    // A CJK Extension-B character is two UTF-16 units but one code point.
    expect([...sanitizeUsernameFromClaim('𠀋'.repeat(40))]).toHaveLength(USERNAME_MAX_LENGTH);
    expect(sanitizeUsernameFromClaim(`${'a'.repeat(29)} b`)).toBe('a'.repeat(29));
  });
});

describe('usernameValidationError', () => {
  const check = (raw: string) => usernameValidationError(normalizeUsernameInput(raw));

  it('USERNAME-020: accepts Chinese, accented, mixed Han/Latin and spaced names', () => {
    for (const ok of ['王小明', '蕃茄', 'José', 'Joey陳', 'Joey Wang', 'first.last', 'a_b-c', 'Иван']) {
      expect(check(ok)).toBeNull();
    }
  });

  it('USERNAME-021: refuses fewer than 2 or more than 30 characters', () => {
    expect(check('x')).toMatch(/between 2 and 30/);
    expect(check('')).toMatch(/between 2 and 30/);
    expect(check('a'.repeat(31))).toMatch(/between 2 and 30/);
    expect(check('a'.repeat(30))).toBeNull();
  });

  it('USERNAME-022: refuses control, zero-width and bidi characters', () => {
    for (const cp of [0x0007, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff]) {
      expect(check(`ab${String.fromCodePoint(cp)}cd`)).toMatch(/only contain/);
    }
  });

  it('USERNAME-023: refuses @ / \\ < > and quotes', () => {
    for (const bad of ['@joey', 'jo/ey', 'jo\\ey', '<joey>', 'jo"ey', "jo'ey", 'jo`ey']) {
      expect(check(bad)).toMatch(/only contain/);
    }
  });

  it('USERNAME-024: refuses emoji', () => {
    expect(check('蕃茄🍅')).toMatch(/only contain/);
  });

  it('USERNAME-025: refuses Latin mixed with Cyrillic or Greek', () => {
    expect(check('pаypal')).toMatch(/cannot mix/);
    expect(check('jοey')).toMatch(/cannot mix/); // Greek omicron
  });

  it('USERNAME-026: normalisation folds full-width and collapses inner whitespace', () => {
    expect(normalizeUsernameInput('  Ｊｏｅｙ \t  Wang ')).toBe('Joey Wang');
  });
});

describe('AUTO_FALLBACK_USERNAME', () => {
  it('USERNAME-030: matches only the names OIDC falls back to', () => {
    for (const auto of ['user', 'user_1', 'user_1234']) expect(AUTO_FALLBACK_USERNAME.test(auto)).toBe(true);
    for (const chosen of ['User', 'users', 'user_12345', 'user_', 'superuser', 'user_ab', '王小明']) {
      expect(AUTO_FALLBACK_USERNAME.test(chosen)).toBe(false);
    }
  });
});
