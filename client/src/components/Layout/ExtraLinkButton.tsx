import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { authApi } from '../../api/client'

/**
 * ENSCON：右下角的額外連結浮動按鈕（例如「🎮 小遊戲」）。
 *
 * 原本是 Cloudflare Worker 注入 arcade-btn.js 做的，改成內建後就能拆掉 Worker。
 * 連結與文字由伺服器的 EXTRA_LINK_URL / EXTRA_LINK_LABEL 經 /api/auth/app-config 給，
 * 沒設 URL（extra_link 為 null）就什麼都不畫，上游行為不變。
 *
 * 只在行程頁、dashboard、分享頁顯示；登入／註冊頁不顯示（不要搶 LINE 登入按鈕的注意力）。
 */
export interface ExtraLink { url: string; label: string }

/** 會顯示按鈕的路徑：行程頁、dashboard、分享頁。 */
export const EXTRA_LINK_PATH_RE = /^\/(trips\/|dashboard|shared\/)/

const DEFAULT_LABEL = '🔗'

// app-config 整個 session 只抓一次：路由切換時元件不會反覆打 API。
let configPromise: Promise<ExtraLink | null> | null = null
function loadExtraLink(): Promise<ExtraLink | null> {
  if (!configPromise) {
    // new Promise 包起來：getAppConfig 同步丟錯（例如測試裡被 mock 掉）也只會變成 null。
    configPromise = new Promise<{ extra_link?: ExtraLink | null }>(resolve => resolve(authApi.getAppConfig()))
      .then((c: { extra_link?: ExtraLink | null }) => (c?.extra_link?.url ? c.extra_link : null))
      .catch(() => { configPromise = null; return null })
  }
  return configPromise
}

/** 測試用：清掉快取。 */
export function __resetExtraLinkCache(): void { configPromise = null }

export default function ExtraLinkButton() {
  const { pathname } = useLocation()
  const [link, setLink] = useState<ExtraLink | null>(null)
  const show = EXTRA_LINK_PATH_RE.test(pathname)

  useEffect(() => {
    if (!show) return
    let cancelled = false
    loadExtraLink().then(l => { if (!cancelled) setLink(l) })
    return () => { cancelled = true }
  }, [show])

  if (!show || !link) return null

  return (
    <>
      {/* 手機版要在底部工具列上方（104px + 安全區），桌機 24px；跟 arcade-btn.js 一樣 */}
      <style>{`
        .enscon-extra-link{position:fixed;right:14px;bottom:calc(env(safe-area-inset-bottom, 0px) + 104px);z-index:900;
          display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:999px;
          background:#111827;color:#fff;font-weight:700;font-size:14px;text-decoration:none;
          box-shadow:0 4px 14px rgba(0,0,0,0.18)}
        @media (min-width:1024px){.enscon-extra-link{right:24px;bottom:24px}}
      `}</style>
      <a
        className="enscon-extra-link"
        data-testid="extra-link-button"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {link.label || DEFAULT_LABEL}
      </a>
    </>
  )
}
