import { apiClient, placesApi } from '../api/client'
import { useTripStore } from '../store/tripStore'

// 貼上文字自動排行程：呼叫解析 API、把結果轉成預覽列、一次送出加入行程。
// 加入行程走 POST /trips/:id/import-text/apply：伺服器在一個 transaction 裡建 place + assignment，
// 全成功或全不建，中途失敗不會留下半套站點。

/** 與伺服器 MAX_TEXT_CHARS（server/src/nest/text-import/rules.ts）同一個數字。 */
export const TEXT_IMPORT_MAX_CHARS = 6000
/**
 * 解析請求的逾時：AI 後備在伺服器端最多等 45 秒（llm.ts 的 LLM_TIMEOUT_MS），
 * 共用 axios 的 8 秒會讓瀏覽器先放棄、伺服器卻照樣呼叫 AI 並扣掉一次額度。
 */
export const TEXT_IMPORT_TIMEOUT_MS = 60_000

export interface ImportStop { time?: string; name: string; note?: string }
export interface ImportResult {
  days: { date?: string; dayIndex?: number; stops: ImportStop[] }[]
  unassigned: (ImportStop & { label?: string })[]
  source: 'rules' | 'llm'
  /** 伺服器有設 AI 金鑰；沒有就不顯示「讓 AI 再解析一次」 */
  llmAvailable?: boolean
}

/** 預覽列：可編輯名稱／時間、可取消勾選；dayId 為 null 表示未歸類（要使用者指定）。 */
export interface PreviewRow {
  key: string
  name: string
  time: string
  note: string
  checked: boolean
  dayId: number | null
  label?: string
}

export async function importText(tripId: number | string, text: string, useLlm = false): Promise<ImportResult> {
  const r = await apiClient.post(`/trips/${tripId}/import-text`, { text, useLlm }, { timeout: TEXT_IMPORT_TIMEOUT_MS })
  return r.data as ImportResult
}

/** 把解析結果依行程的 days 轉成預覽列（dayIndex 或 date 對得到 day 才算歸類）。 */
export function buildPreviewRows(result: ImportResult, days: { id: number; date?: string | null }[]): PreviewRow[] {
  const rows: PreviewRow[] = []
  let n = 0
  const mk = (s: ImportStop, dayId: number | null, label?: string): PreviewRow => ({
    key: `r${n++}`, name: s.name, time: s.time ?? '', note: s.note ?? '', checked: dayId != null, dayId, label,
  })
  for (const d of result.days) {
    const day = (d.dayIndex != null ? days[d.dayIndex] : undefined) ?? days.find(x => d.date && x.date === d.date)
    for (const s of d.stops) rows.push(mk(s, day?.id ?? null, d.date))
  }
  for (const s of result.unassigned) rows.push(mk(s, null, s.label))
  return rows
}

/** 勾選且已指定日期的站一次送出（伺服器端全有或全無）；沒座標就不填。回傳加入的站數。 */
export async function addRowsToTrip(tripId: number | string, rows: PreviewRow[]): Promise<number> {
  const stops = rows
    .filter(r => r.checked && r.dayId != null && r.name.trim())
    .map(r => ({
      dayId: r.dayId as number,
      name: r.name.trim(),
      ...(/^\d{2}:\d{2}$/.test(r.time) ? { time: r.time } : {}),
      ...(r.note ? { note: r.note } : {}),
    }))
  if (stops.length === 0) return 0
  const res = await apiClient.post(`/trips/${tripId}/import-text/apply`, { stops })
  const added = (res.data as { added: number }).added
  // 已寫入成功；重新整理失敗不算加入失敗（避免使用者以為沒加而重按，造成重複）
  try { await useTripStore.getState().refreshDays(tripId) } catch { /* 下次載入會補上 */ }
  placesApi.list(tripId).then(d => useTripStore.setState({ places: d.places })).catch(() => {})
  return added
}
