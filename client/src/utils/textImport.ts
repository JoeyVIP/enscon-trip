import { apiClient, placesApi, assignmentsApi } from '../api/client'
import { useTripStore } from '../store/tripStore'

// 貼上文字自動排行程：呼叫解析 API、把結果轉成預覽列、逐站建立 place + assignment。
// 不新增寫入端點：加入行程直接用既有的建立 place 與 assignment API。

export const TEXT_IMPORT_MAX_CHARS = 6000

export interface ImportStop { time?: string; name: string; note?: string }
export interface ImportResult {
  days: { date?: string; dayIndex?: number; stops: ImportStop[] }[]
  unassigned: (ImportStop & { label?: string })[]
  source: 'rules' | 'llm'
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
  const r = await apiClient.post(`/trips/${tripId}/import-text`, { text, useLlm })
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

/** 逐站建立；沒座標就不填（之後可用地圖搜尋補）。回傳成功加入的站數。 */
export async function addRowsToTrip(tripId: number | string, rows: PreviewRow[]): Promise<number> {
  let added = 0
  for (const r of rows) {
    if (!r.checked || r.dayId == null || !r.name.trim()) continue
    const { place } = await placesApi.create(tripId, {
      name: r.name.trim(),
      place_time: /^\d{2}:\d{2}$/.test(r.time) ? r.time : null,
      notes: r.note || null,
    })
    await assignmentsApi.create(tripId, r.dayId, { place_id: place.id })
    added++
  }
  if (added > 0) {
    await useTripStore.getState().refreshDays(tripId)
    placesApi.list(tripId).then(d => useTripStore.setState({ places: d.places })).catch(() => {})
  }
  return added
}
