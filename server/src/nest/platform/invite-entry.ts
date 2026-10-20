import type { Request } from 'express';

/**
 * ENSCON：邀請連結不經 SPA。
 *
 * 朋友拿到的連結是 /register?invite=X（或 /login?invite=X）。這種網址原本一律回 index.html，
 * 由前端讀網址上的 X、再組 LINE 登入連結。中間任何一段出錯（舊 service worker 端出舊版前端、
 * 舊版前端把 X 從網址拿掉、更新後重新載入），按 LINE 登入時就沒帶邀請碼，伺服器只能回
 * registration_disabled。
 *
 * 所以在 SPA fallback 回 index.html 之前先看一眼：登入頁目前只給 LINE（OIDC）一條路、而且
 * 這組邀請碼還能用，就直接 302 到 /api/auth/oidc/login?invite=X&remember=1，不經前端。
 * /api 在 service worker 的 navigateFallbackDenylist 裡，已經裝了 SW 的瀏覽器也照樣到得了伺服器。
 *
 * 其他情況維持原行為（回 index.html）：
 * - 密碼表單沒藏（一般註冊模式）、還沒有任何使用者（首次建立 admin）、OIDC 沒設定或關閉
 * - 網址帶 ?pw=1（管理員入口）、?redirect=（OAuth 授權交接）、oidc_code／oidc_error（登入回程）
 * - 邀請碼格式不對、找不到、過期或用完 —— 讓前端照常顯示「邀請連結無效或已過期」，
 *   不要先把人送去 LINE 登一輪才失敗
 * - 連結預覽爬蟲（Discord／LINE／Slack…），預覽卡維持「ENSCON 旅程」，不會變成 LINE 登入頁
 *
 * 限制：已經裝了舊 service worker 的瀏覽器，頁面導覽會先被 SW 攔下、直接回快取的 index.html，
 * 伺服器根本看不到這個請求。這裡保護的是新使用者，以及 SW 更新之後的下一次開啟。
 */

/** DI token：SpaFallbackFilter 用它問 OIDC 那邊「現在能不能直接送去 LINE 登入」。 */
export const INVITE_ENTRY_GATE = Symbol('INVITE_ENTRY_GATE');

export interface InviteEntryGate {
  /** 登入頁只給 OIDC 一條路，而且這組邀請碼現在還能用。 */
  allowsInviteEntry(invite: string): boolean;
}

/** 會被直接送去 LINE 登入的頁面（容許結尾斜線）。 */
export const INVITE_ENTRY_PATHS: ReadonlySet<string> = new Set(['/register', '/login']);

/** 跟前端 utils/inviteStore.ts 的 INVITE_RE 一致。 */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** 跟前端 inviteStore 同一個 cookie：LINE 登入失敗回登入頁時，「重試」鈕還能補回邀請碼。 */
export const INVITE_COOKIE = 'enscon_invite';
export const INVITE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

// 連結預覽用的爬蟲。只列明確的名字，不用 /bot/i 這種會誤傷手機型號（CUBOT…）的寫法。
// LINE／Discord 的 App 內建瀏覽器 UA（含 "Line/"、"Discord/"）不在這裡面。
const LINK_PREVIEW_UA_RE =
  /Discordbot|facebookexternalhit|Facebot|Twitterbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Googlebot|bingbot|Applebot|Embedly|Iframely|line-poker/i;

// 這些參數在場時，頁面本身有事要做，交回前端處理。
const SPA_ONLY_PARAMS = ['pw', 'redirect', 'oidc_code', 'oidc_error'] as const;

/**
 * 這個請求是不是「帶著格式合法邀請碼的登入／註冊頁」；是就回邀請碼，不是就回 null。
 * 只看請求本身，不碰設定或資料庫（那些由 InviteEntryGate 決定）。
 */
export function inviteFromEntryRequest(req: Pick<Request, 'method' | 'path' | 'query' | 'headers'>): string | null {
  if (req.method !== 'GET') return null;
  const pathname = req.path.replace(/(?<!\/)\/+$/, '');
  if (!INVITE_ENTRY_PATHS.has(pathname)) return null;
  const query = req.query as Record<string, unknown>;
  if (SPA_ONLY_PARAMS.some((k) => query[k] !== undefined)) return null;
  const invite = query.invite;
  if (typeof invite !== 'string' || !INVITE_TOKEN_RE.test(invite)) return null;
  const ua = req.headers['user-agent'];
  if (typeof ua === 'string' && LINK_PREVIEW_UA_RE.test(ua)) return null;
  return invite;
}

/** 直接開始 LINE 登入的網址（相對路徑，跟登入頁 LINE 鈕的 href 同一個形式）。 */
export function inviteLoginUrl(invite: string): string {
  return `/api/auth/oidc/login?invite=${encodeURIComponent(invite)}&remember=1`;
}
