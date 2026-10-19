/**
 * The product name for outgoing mail: "ENSCON 旅程" for the Chinese locales,
 * "ENSCON Trip" for every other language. See NOTICE.md / TRADEMARKS.md: this is
 * a modified version of TREK and must not use TREK's name as its own.
 */
export function brandName(lang?: string): string {
  return lang && /^zh/i.test(lang) ? 'ENSCON 旅程' : 'ENSCON Trip';
}

/** Short line under the name in the mail header. */
export function brandTagline(lang?: string): string {
  return lang && /^zh/i.test(lang) ? '你的旅程，大家一起規劃' : 'Plan trips together';
}
