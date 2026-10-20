import { describe, it, expect } from 'vitest';
import { API_CACHE_CONTROL, API_VARY, isApiPath, toPrivateCacheControl } from '../../../src/utils/cacheControl';

describe('API cache policy constants', () => {
  it('keeps every API answer out of shared caches and out of the browser store', () => {
    expect(API_CACHE_CONTROL).toBe('private, no-store');
    expect(API_VARY).toBe('Cookie, Authorization');
  });
});

describe('isApiPath', () => {
  it('matches /api and everything below it', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/auth/me')).toBe(true);
    expect(isApiPath('/api/trips/2/budget')).toBe(true);
  });

  it('does not match the SPA, uploads, or a look-alike prefix', () => {
    expect(isApiPath('/')).toBe(false);
    expect(isApiPath('/trips/2')).toBe(false);
    expect(isApiPath('/uploads/files/a.pdf')).toBe(false);
    expect(isApiPath('/apiary')).toBe(false);
  });
});

describe('toPrivateCacheControl', () => {
  it('turns a public upstream policy into a private one and keeps the browser lifetime', () => {
    expect(toPrivateCacheControl('public, max-age=86400')).toBe('private, max-age=86400');
  });

  it('drops s-maxage, which only a shared cache reads', () => {
    expect(toPrivateCacheControl('public, max-age=60, s-maxage=3600, immutable')).toBe('private, max-age=60, immutable');
  });

  it('does not repeat private when the upstream already said it', () => {
    expect(toPrivateCacheControl('private, max-age=3600')).toBe('private, max-age=3600');
    expect(toPrivateCacheControl('PRIVATE, no-cache')).toBe('private, no-cache');
  });

  it('keeps no-store as no-store', () => {
    expect(toPrivateCacheControl('no-store')).toBe('private, no-store');
  });

  it('falls back to the API default when nothing usable is left', () => {
    expect(toPrivateCacheControl('')).toBe(API_CACHE_CONTROL);
    expect(toPrivateCacheControl('public')).toBe(API_CACHE_CONTROL);
    expect(toPrivateCacheControl(' , public ,')).toBe(API_CACHE_CONTROL);
  });
});
