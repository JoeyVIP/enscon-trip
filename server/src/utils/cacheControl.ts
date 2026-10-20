/**
 * Cache-Control policy for the API.
 *
 * Every /api response is about one signed-in user, one trip, or one share token
 * unless a route says otherwise, so the default is that nobody but the browser
 * that asked may keep it, and the browser may not either. A CDN in front of the
 * instance (Cloudflare with a "cache everything" rule, say) otherwise stores the
 * first signed-in answer to /api/auth/me and hands it to the next visitor without
 * a cookie.
 *
 * `Vary: Cookie, Authorization` is the same statement for caches that do honour
 * Vary: the answer depends on who is asking.
 */
export const API_CACHE_CONTROL = 'private, no-store';
export const API_VARY = 'Cookie, Authorization';

/** True for the API surface the default above covers. */
export function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

/**
 * Rewrites a Cache-Control value that came from somewhere we do not control (an
 * Immich/Synology upstream, a plugin's reply) so that only the browser may keep
 * it: `public` and `s-maxage` go, `private` goes first. Whatever else the value
 * said (max-age, immutable, no-cache) is kept, so a browser still caches what it
 * was told it could. A value with nothing left in it gets the API default.
 */
export function toPrivateCacheControl(value: string): string {
  const kept = value
    .split(',')
    .map((directive) => directive.trim())
    .filter((directive) => {
      if (!directive) return false;
      const name = directive.split('=')[0].trim().toLowerCase();
      return name !== 'public' && name !== 'private' && name !== 's-maxage';
    });
  return kept.length ? ['private', ...kept].join(', ') : API_CACHE_CONTROL;
}
