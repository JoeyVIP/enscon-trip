/**
 * ENSCON：AGPL-3.0 第 13 條——透過網路使用這個服務的人，要拿得到「改過的原始碼」。
 * 所以每一頁（含登入頁、分享頁）都放一個小小的原始碼連結，並註明基於 TREK。
 *
 * 位置在左下角、很小、半透明：不跟底部工具列（置中）和右下角的額外連結（EXTRA_LINK）搶位置。
 * 登入後的手機版有底部工具列，連結改放在工具列「更多」選單第一格（MBottomNav），這裡不浮出來；
 * 行程頁（手機版用自己的底部導覽列）放在導覽列「更多」選單最底下一列（MMehrSheet）——
 * 浮動小字原本疊在導覽列「行程」那格的左下邊緣。
 * 登入／註冊／分享頁（沒有導覽列）仍維持浮動連結。
 * 網址預設是我們的 fork；要換成別的 fork 時，建置時設 VITE_SOURCE_URL。
 */
import { useLocation } from 'react-router'
import { useIsPhone } from '../../mobile/useIsPhone'
import { isAuthPublicPath } from '../../api/client'

export const SOURCE_URL: string = (import.meta.env?.VITE_SOURCE_URL as string | undefined) || 'https://github.com/JoeyVIP/enscon-trip'
export const UPSTREAM_URL = 'https://github.com/liketrek/TREK'

/** 手機版有底部導覽列的頁面（MBottomNav，或行程頁自己的導覽列）：連結由「更多」選單負責。 */
export function useSourceLinkInMenu(): boolean {
  const isPhone = useIsPhone()
  const { pathname } = useLocation()
  return isPhone && !isAuthPublicPath(pathname)
}

export default function SourceLink() {
  if (useSourceLinkInMenu()) return null
  return (
    <>
      <style>{`
        .enscon-source{position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom, 0px) + 4px);z-index:800;
          font-size:10px;line-height:1.3;color:#6b7280;opacity:.7;background:rgba(255,255,255,.6);
          padding:2px 6px;border-radius:6px;max-width:60vw}
        .enscon-source a{color:inherit;text-decoration:underline}
        @media print{.enscon-source{display:none}}
      `}</style>
      <div className="enscon-source" data-testid="source-link">
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">原始碼</a>
        {' · AGPL-3.0 · 基於 '}
        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">TREK</a>
      </div>
    </>
  )
}
