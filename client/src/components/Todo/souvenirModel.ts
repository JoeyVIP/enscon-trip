// 伴手禮／代購清單的純函式（無 React、無副作用）。
// 資料沿用 todo_items，以 kind === 'souvenir' 區分；category 放分類。
import type { TodoItem } from '../../types'

export const SOUVENIR_KIND = 'souvenir'

// 一鍵建立範本的預設分類（i18n key）。只放分類，不預填商品、價格或免稅金額。
export const SOUVENIR_TEMPLATE_CATEGORY_KEYS = [
  'twSouvenir.cat.cosmetics',
  'twSouvenir.cat.snacks',
  'twSouvenir.cat.daily',
  'twSouvenir.cat.gifts',
] as const

export type SouvenirView = 'recipient' | 'buyer'

export interface SouvenirMember { id: number; username: string }

export const isSouvenir = (i: TodoItem) => i.kind === SOUVENIR_KIND

export const splitSouvenirs = (items: TodoItem[]) => ({
  souvenirs: items.filter(isSouvenir),
  todos: items.filter(i => !isSouvenir(i)),
})

export interface SouvenirGroup {
  key: string
  // null 代表「未填給誰／未指派」，由畫面用翻譯文字顯示
  label: string | null
  items: TodoItem[]
  bought: number
  total: number
}

// 進度：已買 x／共 y（以品項數計，不乘數量）
export function souvenirProgress(items: TodoItem[]) {
  return { bought: items.filter(i => !!i.checked).length, total: items.length }
}

// 依「給誰」或「誰去買」分組；沒填的歸到最後一組（label 為 null）。
export function groupSouvenirs(items: TodoItem[], view: SouvenirView, members: SouvenirMember[]): SouvenirGroup[] {
  const names = new Map(members.map(m => [m.id, m.username]))
  const buckets = new Map<string, TodoItem[]>()
  const labelOf = (i: TodoItem): string | null =>
    view === 'recipient'
      ? (i.recipient?.trim() || null)
      : (i.assigned_user_id != null ? (names.get(i.assigned_user_id) ?? `#${i.assigned_user_id}`) : null)
  const EMPTY = '\u0000'
  for (const i of items) {
    const k = labelOf(i) ?? EMPTY
    buckets.set(k, [...(buckets.get(k) ?? []), i])
  }
  const groups: SouvenirGroup[] = [...buckets.entries()].map(([k, list]) => ({
    key: k === EMPTY ? '' : k,
    label: k === EMPTY ? null : k,
    items: list,
    ...souvenirProgress(list),
  }))
  return groups.sort((a, b) => {
    if (a.label === null) return 1
    if (b.label === null) return -1
    return a.label.localeCompare(b.label)
  })
}

export interface SouvenirStoreTotal { store: string; totalJpy: number; count: number }

// 各店預估合計（單價 × 數量）：給免稅門檻當參考。只算有填店家與價格的品項，
// 店名去頭尾空白後相同就算同一家；金額大的排前面。不判斷是否達標——
// 使用者填的多半是含稅標價，門檻是未稅，實際由店家認定。
export function souvenirStoreTotals(items: TodoItem[]): SouvenirStoreTotal[] {
  const totals = new Map<string, SouvenirStoreTotal>()
  for (const i of items) {
    const store = i.store?.trim()
    if (!store || i.price_jpy == null) continue
    const row = totals.get(store) ?? { store, totalJpy: 0, count: 0 }
    row.totalJpy += i.price_jpy * (i.quantity ?? 1)
    row.count += 1
    totals.set(store, row)
  }
  return [...totals.values()].sort((a, b) => b.totalJpy - a.totalJpy || a.store.localeCompare(b.store))
}
