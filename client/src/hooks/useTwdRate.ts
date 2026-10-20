import { useEffect, useState } from 'react'
import { needsTwd, parseTwdRate } from '../utils/twdFx'

/**
 * 記帳換匯用的「顯示幣別 → TWD」匯率。
 * - 直接打 api.frankfurter.dev（CSP connect-src 已允許，不新增伺服器端呼叫）。
 * - 同一個 session 每個幣別只抓一次；成功就存 localStorage。
 * - 抓失敗但有上次的值 → 'offline'（標示是哪天的匯率）；沒有 → 'error'（顯示「匯率暫時抓不到」，不亂顯示）。
 */

export type TwdRateStatus = 'hidden' | 'loading' | 'live' | 'offline' | 'error'
export interface TwdRateState {
  status: TwdRateStatus
  base: string
  rate: number | null
  /** 匯率日期 yyyy-mm-dd（取不到時為空字串） */
  date: string
}

interface Entry { rate: number; date: string; ts: number }

const FETCH_TIMEOUT_MS = 10_000
const KEY = (base: string) => 'trek_twd_fx_' + base
// 本 session 已成功抓到的結果；失敗不放進來，下次掛載會再試
const session = new Map<string, Entry>()

function readStored(base: string): Entry | null {
  try {
    const raw = localStorage.getItem(KEY(base))
    if (!raw) return null
    const p = JSON.parse(raw) as Entry
    return p && typeof p.rate === 'number' && p.rate > 0 ? p : null
  } catch { return null }
}

/** 取得匯率：session 內只抓一次；失敗退回 localStorage 的舊值。 */
export async function loadTwdRate(base: string): Promise<TwdRateState> {
  const b = base.toUpperCase()
  const hit = session.get(b)
  if (hit) return { status: 'live', base: b, rate: hit.rate, date: hit.date }
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(b)}`, { signal: stop.signal })
    if (!res.ok) throw new Error('http ' + res.status)
    const parsed = parseTwdRate(await res.json())
    if (!parsed) throw new Error('bad payload')
    const entry: Entry = { ...parsed, ts: Date.now() }
    session.set(b, entry)
    try { localStorage.setItem(KEY(b), JSON.stringify(entry)) } catch { /* ignore */ }
    return { status: 'live', base: b, rate: entry.rate, date: entry.date }
  } catch {
    const old = readStored(b)
    if (old) return { status: 'offline', base: b, rate: old.rate, date: old.date || new Date(old.ts).toISOString().slice(0, 10) }
    return { status: 'error', base: b, rate: null, date: '' }
  } finally {
    clearTimeout(timer)
  }
}

/** Test-only：清掉 session 與 localStorage 快取。 */
export function resetTwdRateCache(): void {
  session.clear()
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('trek_twd_fx_')) localStorage.removeItem(k) } catch { /* ignore */ }
}

export function useTwdRate(base: string): TwdRateState {
  const b = (base || '').toUpperCase()
  const show = needsTwd(b)
  const [state, setState] = useState<TwdRateState>({ status: show ? 'loading' : 'hidden', base: b, rate: null, date: '' })

  useEffect(() => {
    if (!show) { setState({ status: 'hidden', base: b, rate: null, date: '' }); return }
    let cancelled = false
    setState(s => (s.base === b && s.status !== 'hidden' ? s : { status: 'loading', base: b, rate: null, date: '' }))
    loadTwdRate(b).then(r => { if (!cancelled) setState(r) })
    return () => { cancelled = true }
  }, [b, show])

  // 幣別剛切換、effect 還沒跑完的那一刻，不要拿舊幣別的匯率亂套
  if (!show) return { status: 'hidden', base: b, rate: null, date: '' }
  return state.base === b ? state : { status: 'loading', base: b, rate: null, date: '' }
}

