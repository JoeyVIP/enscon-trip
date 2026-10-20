// FE-TW-LANDING-001 onwards
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildTrip } from '../../tests/helpers/factories'
import { markFreshLogin, pickLandingTrip, takeFreshLogin, POST_LOGIN_TTL_MS } from './postLoginLanding'

describe('fresh-login mark', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('FE-TW-LANDING-001: is read once, then gone', () => {
    markFreshLogin(true)
    expect(takeFreshLogin()).toEqual({ viaInvite: true })
    expect(takeFreshLogin()).toBeNull()
  })

  it('FE-TW-LANDING-002: goes stale after the TTL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'))
    markFreshLogin(false)
    vi.setSystemTime(new Date(Date.now() + POST_LOGIN_TTL_MS + 1))
    expect(takeFreshLogin()).toBeNull()
  })

  it('FE-TW-LANDING-003: a corrupt value is ignored', () => {
    sessionStorage.setItem('enscon_post_login', '{nope')
    expect(takeFreshLogin()).toBeNull()
  })
})

describe('pickLandingTrip', () => {
  it('FE-TW-LANDING-004: a single live trip is the landing trip', () => {
    const okinawa = buildTrip({ id: 1, title: 'Okinawa' })
    expect(pickLandingTrip([okinawa], false)).toBe(okinawa)
    // An archived trip next to it doesn't make it a choice.
    expect(pickLandingTrip([okinawa, buildTrip({ id: 2, is_archived: 1 })], false)).toBe(okinawa)
  })

  it('FE-TW-LANDING-005: several trips mean the dashboard, unless an invite just added exactly one', () => {
    const own = buildTrip({ id: 1, is_owner: 1 })
    const joined = buildTrip({ id: 2, is_owner: 0, user_id: 77 })
    expect(pickLandingTrip([own, joined], false)).toBeNull()
    expect(pickLandingTrip([own, joined], true)).toBe(joined)
    expect(pickLandingTrip([own, joined, buildTrip({ id: 3, is_owner: 0 })], true)).toBeNull()
  })

  it('FE-TW-LANDING-006: no trips means the dashboard', () => {
    expect(pickLandingTrip([], true)).toBeNull()
  })
})
