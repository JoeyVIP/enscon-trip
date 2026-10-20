import { useState } from 'react'
import { shareApi } from '../../api/client'
import Tooltip from '../shared/Tooltip'
import {
  buildDayShareText, buildSharedTripUrl, buildTripShareText, openLineShare,
  type LineShareStop,
} from '../../utils/lineShare'

// LINE 分享入口（桌面日程側欄與手機版共用）。
// 不用 LINE 的註冊商標圖樣，內嵌通用「對話泡泡」SVG，顏色為 LINE 綠。

export const LINE_GREEN = '#06C755'

type TFn = (key: string, params?: Record<string, string | number>) => string
type ToastLike = { error: (msg: string) => void }

export function LineBubbleIcon({ size = 14, color = LINE_GREEN }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" focusable="false">
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.5 1.45 4.73 3.72 6.2-.12.9-.5 2.2-1.4 3.3a.5.5 0 0 0 .52.8c1.9-.4 3.5-1.3 4.5-2.1.8.2 1.7.3 2.66.3 5.52 0 10-3.58 10-8S17.52 3 12 3Z" />
    </svg>
  )
}

/**
 * 取得行程公開分享連結（只在需要時才建立）。
 * - 已有連結就直接用
 * - 沒有且 create=true：建立，預設只開行程與地圖（訂位／預算／清單／協作皆關閉）
 * 讀取與建立都需要 share_manage 權限，沒權限時呼叫端應已禁用按鈕。
 */
export async function ensureTripShareUrl(tripId: number | string, create: boolean): Promise<string | null> {
  const existing = await shareApi.getLink(tripId)
  if (existing?.token) return buildSharedTripUrl(existing.token)
  if (!create) return null
  const created = await shareApi.createLink(tripId, {
    share_map: true, share_bookings: false, share_packing: false, share_budget: false, share_collab: false,
  })
  return created?.token ? buildSharedTripUrl(created.token) : null
}

/** 手機版匯出面板用：一次做完「取得／建立連結 → 開 LINE」。 */
export async function shareTripToLine(
  tripId: number | string,
  trip: { title?: string | null; start_date?: string | null; end_date?: string | null },
  toast: ToastLike,
  t: TFn,
): Promise<void> {
  try {
    const url = await ensureTripShareUrl(tripId, true)
    if (!url) throw new Error('no token')
    openLineShare(buildTripShareText(trip, url))
  } catch {
    toast.error(t('twLineShare.error'))
  }
}

/** 桌面版工具列：「分享行程到 LINE」。沒有 share_manage 權限時禁用並提示。 */
export function LineTripShareButton({ tripId, trip, canManageShare, t, toast }: {
  tripId: number | string
  trip: { title?: string | null; start_date?: string | null; end_date?: string | null }
  canManageShare: boolean
  t: TFn
  toast: ToastLike
}) {
  const [busy, setBusy] = useState(false)
  const label = canManageShare ? t('twLineShare.shareTrip') : t('twLineShare.needOwner')
  return (
    <Tooltip label={label} placement="bottom">
      <button
        type="button"
        aria-label={t('twLineShare.shareTrip')}
        disabled={!canManageShare || busy}
        onClick={async () => {
          setBusy(true)
          try { await shareTripToLine(tripId, trip, toast, t) } finally { setBusy(false) }
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '5px 10px', borderRadius: 8,
          border: `1px solid ${LINE_GREEN}`, background: 'transparent', color: LINE_GREEN, fontSize: 12, fontWeight: 600,
          cursor: canManageShare && !busy ? 'pointer' : 'not-allowed', opacity: canManageShare ? 1 : 0.45,
        }}
      >
        <LineBubbleIcon size={14} />
        LINE
      </button>
    </Tooltip>
  )
}

/**
 * 每一天標頭的小圖示按鈕：「分享今天行程到 LINE」。純前端組字串；
 * 只有文字過長被截斷時，才（在有權限的前提下）讀取既有的公開連結附上，不會自動建立。
 */
export function LineDayShareButton({ tripId, date, locale, title, stops, canManageShare, t, size = 14, className }: {
  tripId: number | string
  date?: string | null
  locale: string
  title?: string | null
  stops: LineShareStop[]
  canManageShare: boolean
  t: TFn
  size?: number
  className?: string
}) {
  const label = t('twLineShare.shareDay')
  return (
    <Tooltip label={label} placement="top">
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={async e => {
          e.stopPropagation()
          const build = (tripUrl: string | null) => buildDayShareText({ date, locale, title, stops, tripUrl })
          let text = build(null)
          // 先用不含連結的版本判斷是否被截斷（結尾為「…」）；被截斷才去讀連結
          if (text.endsWith('…') && canManageShare) {
            try { text = build(await ensureTripShareUrl(tripId, false)) } catch { /* 讀不到連結就用截斷版 */ }
          }
          openLineShare(text)
        }}
        style={{ display: 'grid', placeItems: 'center', padding: 7, border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <LineBubbleIcon size={size} />
      </button>
    </Tooltip>
  )
}
