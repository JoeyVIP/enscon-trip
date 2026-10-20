// FE-PAGE-BILLOK-HOOK-001 to 004
import { act, renderHook, waitFor } from '@testing-library/react'
import { billingApi } from '../../api/billing'
import { useBillingSuccess } from './useBillingSuccess'

const navigate = vi.fn()
let search = 'ref=r1'
vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(search)],
}))

const base = {
  ref: 'r1', status: 'fulfilled' as const, trip_id: 5, trip_title: 'T', invite_token: 'tok',
  seats: 10, amount: 299, currency: 'TWD', paid_at: '2026-10-20T08:00:00.000Z',
}

beforeEach(() => {
  navigate.mockClear()
  search = 'ref=r1'
  vi.spyOn(billingApi, 'purchase').mockResolvedValue(base)
})
afterEach(() => vi.restoreAllMocks())

describe('useBillingSuccess', () => {
  it('FE-PAGE-BILLOK-HOOK-001: 團開好了 → 邀請連結指向 /join/<token>，可打開行程', async () => {
    const { result } = renderHook(() => useBillingSuccess())
    await waitFor(() => expect(result.current.state).toBe('fulfilled'))
    expect(result.current.inviteUrl).toBe(`${window.location.origin}/join/tok`)
    act(() => result.current.openTrip())
    expect(navigate).toHaveBeenCalledWith('/trips/5')
  })

  it('FE-PAGE-BILLOK-HOOK-002: 還沒收到付款通知 → pending，之後再問一次就變 fulfilled', { timeout: 8000 }, async () => {
    vi.mocked(billingApi.purchase)
      .mockResolvedValueOnce({ ...base, status: 'pending', trip_id: null, invite_token: null })
      .mockResolvedValueOnce(base)
    const { result } = renderHook(() => useBillingSuccess())
    await waitFor(() => expect(result.current.state).toBe('pending'))
    // 輪詢間隔是真的 2.5 秒
    await waitFor(() => expect(result.current.state).toBe('fulfilled'), { timeout: 4000 })
    expect(billingApi.purchase).toHaveBeenCalledTimes(2)
  })

  it('FE-PAGE-BILLOK-HOOK-003: 404 或網址沒有 ref → notFound', async () => {
    vi.mocked(billingApi.purchase).mockRejectedValueOnce({ response: { status: 404 } })
    const { result } = renderHook(() => useBillingSuccess())
    await waitFor(() => expect(result.current.state).toBe('notFound'))
    search = ''
    const empty = renderHook(() => useBillingSuccess())
    expect(empty.result.current.state).toBe('notFound')
  })

  it('FE-PAGE-BILLOK-HOOK-004: 付款失敗對應成 failed；複製邀請連結', async () => {
    vi.mocked(billingApi.purchase).mockResolvedValueOnce({ ...base, status: 'payment_failed' })
    const { result } = renderHook(() => useBillingSuccess())
    await waitFor(() => expect(result.current.state).toBe('failed'))
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await act(() => result.current.copyInvite())
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/tok`)
    expect(result.current.copied).toBe(true)
  })
})
