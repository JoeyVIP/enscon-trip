/**
 * Username rules shared by the OIDC sign-up path and the self-service rename.
 *
 * A username is what other trip members see beside notes, chat messages and
 * votes, so it has to carry a person's real name — LINE display names are
 * mostly Chinese — while refusing anything that could be used to dress one
 * account up as another or to smuggle markup into a page.
 *
 * Allow-list, not deny-list: Unicode letters (\p{L}), Unicode digits (\p{N}),
 * `_`, `.`, `-` and a single ASCII space between words. Everything else is
 * out, which in particular covers
 *   - control and format characters (\p{C}), including the zero-width
 *     U+200B–U+200F, the bidi embeddings/overrides U+202A–U+202E and the bidi
 *     isolates U+2066–U+2069 that can make a name render as someone else's;
 *   - `@` (mention syntax), `/` and `\` (path segments), `<` `>` and quotes
 *     (markup / attribute breakouts);
 *   - emoji and other symbols (\p{S}), and combining marks (\p{M}) that could
 *     stack into unreadable glyph towers.
 * Input is NFKC-normalised first, so full-width `Ｊｏｅｙ` becomes `Joey` and
 * collides with an existing `joey` instead of passing as a look-alike.
 * Latin mixed with Cyrillic or Greek in one name is refused (or, for an
 * IdP-supplied name, the Cyrillic/Greek letters are dropped): that is the
 * classic homoglyph trick (`pаypal` with a Cyrillic `а`).
 */

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 30;

/** Usernames the OIDC path falls back to when a name claim sanitises to nothing. */
export const AUTO_FALLBACK_USERNAME = /^user(_\d{1,4})?$/;

const WHITESPACE_RUN = /[\p{Z}\t\n\r\f\v]+/gu;
const NOT_ALLOWED = /[^\p{L}\p{N}_.\- ]/gu;
const ONLY_ALLOWED = /^[\p{L}\p{N}_.\- ]+$/u;
const LATIN = /\p{Script=Latin}/u;
const CYRILLIC_OR_GREEK = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;
const CYRILLIC_OR_GREEK_ALL = /[\p{Script=Cyrillic}\p{Script=Greek}]/gu;

/** NFKC, every whitespace run (tab, newline, NBSP, ideographic space…) → one ASCII space, trimmed. */
export function normalizeUsernameInput(raw: string): string {
  return raw.normalize('NFKC').replace(WHITESPACE_RUN, ' ').trim();
}

function hasMixedConfusableScripts(value: string): boolean {
  return LATIN.test(value) && CYRILLIC_OR_GREEK.test(value);
}

/** Length in code points, so a CJK Extension-B character counts once. */
function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Turn an IdP display name into a username, keeping Chinese/Japanese/Korean and
 * accented letters. Returns '' when nothing survives (e.g. an all-emoji name);
 * the caller picks the fallback.
 */
export function sanitizeUsernameFromClaim(raw: string): string {
  let value = normalizeUsernameInput(raw).replace(NOT_ALLOWED, '');
  if (hasMixedConfusableScripts(value)) value = value.replace(CYRILLIC_OR_GREEK_ALL, '');
  value = value.replace(/ {2,}/g, ' ').trim();
  return [...value].slice(0, USERNAME_MAX_LENGTH).join('').trim();
}

/** Validate a username a user typed. Returns the error string, or null when it is acceptable. */
export function usernameValidationError(normalized: string): string | null {
  const length = codePointLength(normalized);
  if (length < USERNAME_MIN_LENGTH || length > USERNAME_MAX_LENGTH) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!ONLY_ALLOWED.test(normalized)) {
    return 'Username can only contain letters, numbers, spaces, underscores, dots and hyphens';
  }
  if (hasMixedConfusableScripts(normalized)) {
    return 'Username cannot mix Latin with Cyrillic or Greek letters';
  }
  return null;
}
