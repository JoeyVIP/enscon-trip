/**
 * ENSCON：邀請碼不掉。
 *
 * 朋友分享的連結是 /register?invite=X。使用者在 LINE 內建瀏覽器、外部瀏覽器、
 * 重新整理之間跳來跳去時，網址上的 X 很容易不見，導致 LINE 登入沒帶邀請碼而被擋。
 * 所以進頁面時把 X 同時存兩處：
 * - localStorage（key enscon_invite，附時間戳，30 分鐘有效）
 * - first-party cookie（SameSite=Lax、Path=/、HTTPS 時加 Secure、10 分鐘；不設 Domain，只回送本站）
 * 按「LINE 登入」時網址沒有 invite 就從這兩處補；登入成功或明確失敗後清掉。
 * 每個存取都包 try：私密模式寫不進去就退回只靠網址，不能讓頁面壞掉。
 */
export const INVITE_STORAGE_KEY = 'enscon_invite'
export const INVITE_COOKIE_KEY = 'enscon_invite'
export const INVITE_LS_TTL_MS = 30 * 60 * 1000
export const INVITE_COOKIE_MAX_AGE_S = 10 * 60
// 跟 server／line-only.js 一致，避免存進奇怪的字串
export const INVITE_RE = /^[A-Za-z0-9_-]{8,128}$/

// HTTPS 下加 Secure，邀請碼不會經明文 HTTP 送出；本機 http 開發時不加（加了瀏覽器會丟掉 cookie）。
function secureAttr(): string {
  try { return window.location.protocol === 'https:' ? '; Secure' : '' } catch { return '' }
}

/** 同時存進 localStorage 與 cookie；格式不對的值直接忽略。 */
export function saveInvite(invite: string): void {
  if (!INVITE_RE.test(invite)) return
  try {
    localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify({ v: invite, t: Date.now() }))
  } catch { /* 私密模式寫不進去就算了 */ }
  try {
    document.cookie = `${INVITE_COOKIE_KEY}=${encodeURIComponent(invite)}; Max-Age=${INVITE_COOKIE_MAX_AGE_S}; Path=/; SameSite=Lax${secureAttr()}`
  } catch { /* ignore */ }
}

function readLocalStorage(): string {
  try {
    const raw = localStorage.getItem(INVITE_STORAGE_KEY)
    if (!raw) return ''
    // 舊版前端（#14 之前，例如 sha-a818980）在同一個 key 存的是「邀請碼本身」，不是 JSON。
    // 舊 service worker 端出舊版前端 → 它存好邀請碼、把網址上的 invite 拿掉 → SW 更新後重新載入，
    // 新版前端只剩這一份可以讀；讀不懂就會變成「LINE 登入沒帶邀請碼」（10/20 事故）。
    // 認得舊格式，並改寫成新格式、從現在起算 30 分鐘，免得一份舊值永遠不過期。
    if (INVITE_RE.test(raw)) {
      try { localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify({ v: raw, t: Date.now() })) } catch { /* ignore */ }
      return raw
    }
    const parsed = JSON.parse(raw) as { v?: unknown; t?: unknown }
    if (typeof parsed?.v !== 'string' || typeof parsed.t !== 'number') return ''
    if (Date.now() - parsed.t > INVITE_LS_TTL_MS) return ''
    return INVITE_RE.test(parsed.v) ? parsed.v : ''
  } catch { return '' }
}

function readCookie(): string {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(INVITE_COOKIE_KEY + '='))
    if (!hit) return ''
    const v = decodeURIComponent(hit.slice(INVITE_COOKIE_KEY.length + 1))
    return INVITE_RE.test(v) ? v : ''
  } catch { return '' }
}

/** 取回還有效的邀請碼：localStorage 優先，沒有再看 cookie；都沒有回空字串。 */
export function loadInvite(): string {
  return readLocalStorage() || readCookie()
}

/** 登入成功或明確失敗後清掉兩處。 */
export function clearInvite(): void {
  try { localStorage.removeItem(INVITE_STORAGE_KEY) } catch { /* ignore */ }
  try {
    document.cookie = `${INVITE_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secureAttr()}`
  } catch { /* ignore */ }
}
