import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../tests/helpers/msw/server'
import { loadTwdRate, resetTwdRateCache, useTwdRate } from './useTwdRate'

const FX_URL = 'https://api.frankfurter.dev/v2/rates'
const OK = [{ date: '2026-10-19', base: 'JPY', quote: 'TWD', rate: 0.2084 }, { date: '2026-10-19', base: 'JPY', quote: 'USD', rate: 0.0065 }]

describe('loadTwdRate / useTwdRate（記帳換匯匯率）', () => {
  beforeEach(() => resetTwdRateCache())

  it('抓到 JPY→TWD 並存進 localStorage', async () => {
    server.use(http.get(FX_URL, () => HttpResponse.json(OK)))
    const r = await loadTwdRate('jpy')
    expect(r).toEqual({ status: 'live', base: 'JPY', rate: 0.2084, date: '2026-10-19' })
    expect(JSON.parse(localStorage.getItem('trek_twd_fx_JPY') as string).rate).toBe(0.2084)
  })

  it('同一個 session 只抓一次', async () => {
    let calls = 0
    server.use(http.get(FX_URL, () => { calls++; return HttpResponse.json(OK) }))
    await loadTwdRate('JPY')
    await loadTwdRate('JPY')
    expect(calls).toBe(1)
  })

  it('離線：用 localStorage 上次的值並標示 offline 與日期', async () => {
    localStorage.setItem('trek_twd_fx_JPY', JSON.stringify({ rate: 0.21, date: '2026-10-01', ts: 1 }))
    server.use(http.get(FX_URL, () => HttpResponse.error()))
    expect(await loadTwdRate('JPY')).toEqual({ status: 'offline', base: 'JPY', rate: 0.21, date: '2026-10-01' })
  })

  it('抓不到又沒有快取：error，不給匯率', async () => {
    server.use(http.get(FX_URL, () => HttpResponse.error()))
    expect(await loadTwdRate('JPY')).toEqual({ status: 'error', base: 'JPY', rate: null, date: '' })
  })

  it('回應格式不對（沒有 TWD）視為失敗', async () => {
    server.use(http.get(FX_URL, () => HttpResponse.json([])))
    expect((await loadTwdRate('JPY')).status).toBe('error')
  })

  it('顯示幣別是 TWD：hidden，完全不打 API', async () => {
    let calls = 0
    server.use(http.get(FX_URL, () => { calls++; return HttpResponse.json(OK) }))
    const { result } = renderHook(() => useTwdRate('TWD'))
    await new Promise(r => setTimeout(r, 20))
    expect(result.current.status).toBe('hidden')
    expect(calls).toBe(0)
  })

  it('hook：loading → live', async () => {
    server.use(http.get(FX_URL, () => HttpResponse.json(OK)))
    const { result } = renderHook(() => useTwdRate('JPY'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('live'))
    expect(result.current.rate).toBe(0.2084)
  })
})
