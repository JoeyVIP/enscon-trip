import type { Trip } from '../types'

/**
 * ENSCON：登入後直接進行程。
 *
 * 真人回饋：登入成功後停在首頁，不知道要點行程卡片才看得到內容。所以「剛登入」
 * 這一次，如果這個人只屬於一個行程（或剛透過邀請連結加入、只多了一個不是自己
 * 開的行程），RootRedirect 直接送進那個行程頁，不停在首頁。
 *
 * 只在剛登入時生效：登入頁成功後寫一個 sessionStorage 標記，RootRedirect 讀一次
 * 就清掉。之後再從首頁捷徑或 PWA 打開 '/' 還是照原本的起始頁設定（預設首頁），
 * 使用者主動回首頁不會被一直彈進行程。
 */
const KEY = 'enscon_post_login'
/** A mark older than this is stale (the login was abandoned before reaching '/'). */
export const POST_LOGIN_TTL_MS = 5 * 60 * 1000

export interface FreshLogin {
  /** The login carried an invite link, so the user may have just joined a trip. */
  viaInvite: boolean
}

/** Called by the login page right before it hands over to the start route. */
export function markFreshLogin(viaInvite: boolean): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ i: viaInvite ? 1 : 0, t: Date.now() }))
  } catch { /* private mode: the user just lands on the dashboard as before */ }
}

/** Reads the mark once and clears it; null when there is none or it went stale. */
export function takeFreshLogin(): FreshLogin | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const parsed = JSON.parse(raw) as { i?: unknown; t?: unknown }
    if (typeof parsed?.t !== 'number' || Date.now() - parsed.t > POST_LOGIN_TTL_MS) return null
    return { viaInvite: parsed.i === 1 }
  } catch { return null }
}

const isOwn = (trip: Trip): boolean => trip.is_owner === 1 || (trip.is_owner as unknown) === true

/**
 * The one trip a fresh login should open, or null for the dashboard.
 *
 *  - exactly one trip that isn't archived → that trip
 *  - came through an invite and exactly one of the trips isn't their own → that
 *    one (the trip the invite just added them to)
 *  - anything else is a real choice, so the dashboard
 */
export function pickLandingTrip(trips: Trip[], viaInvite: boolean): Trip | null {
  const live = trips.filter(trip => !trip.is_archived)
  if (live.length === 1) return live[0]
  if (viaInvite) {
    const joined = live.filter(trip => !isOwn(trip))
    if (joined.length === 1) return joined[0]
  }
  return null
}
