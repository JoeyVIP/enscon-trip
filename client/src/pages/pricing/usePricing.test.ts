// FE-PAGE-PRICING-HOOK-001 to 008
import { act, renderHook, waitFor } from '@testing-library/react'
import { billingApi } from '../../api/billing'
import { useAuthStore } from '../../store/authStore'
import { usePricing } from './usePricing'

const navigate = vi.fn()
let search = ''
vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(search)],
}))
const openCheckout = vi.fn()
vi.mock('./openCheckout', () => ({ openCheckout: (url: string) => openCheckout(url) }))

const plan = {
  enabled: true, price_twd: 299, seats: 10, days_after_return: 30,
  consent_ver: '2026-10-20', terms_url: '/legal/terms', privacy_url: '/legal/privacy',
}

beforeEach(() => {
  navigate.mockClear()
  openCheckout.mockClear()
  search = ''
  useAuthStore.setState({ isAuthenticated: true })
  vi.spyOn(billingApi, 'plan').mockResolvedValue(plan)
  vi.spyOn(billingApi, 'checkout').mockResolvedValue({ url: 'https://checkout.recur.tw/cs_1', ref: 'r1' })
  vi.spyOn(billingApi, 'me').mockResolvedValue({ needs_purchase: true, free_organizer: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.setState({ isAuthenticated: false })
})

describe('usePricing', () => {
  it('FE-PAGE-PRICING-HOOK-001: 讀到方案；沒勾同意前不能買', async () => {
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.plan).toEqual(plan))
    expect(result.current.enabled).toBe(true)
    expect(result.current.canBuy).toBe(false)
    await act(() => result.current.buy())
    expect(billingApi.checkout).not.toHaveBeenCalled()
  })

  it('FE-PAGE-PRICING-HOOK-002: 勾了同意 → 建結帳並跳到 Recur 付款頁', async () => {
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    act(() => result.current.setConsent(true))
    expect(result.current.canBuy).toBe(true)
    await act(() => result.current.buy())
    expect(billingApi.checkout).toHaveBeenCalledWith('2026-10-20', '')
    expect(openCheckout).toHaveBeenCalledWith('https://checkout.recur.tw/cs_1')
  })

  it('FE-PAGE-PRICING-HOOK-003: 沒登入 → 先去登入，登入完回收費頁', async () => {
    useAuthStore.setState({ isAuthenticated: false })
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    await act(() => result.current.buy())
    expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fpricing')
    expect(billingApi.checkout).not.toHaveBeenCalled()
  })

  it('FE-PAGE-PRICING-HOOK-004: 409 → 條款更新提示；其他錯誤 → 一般錯誤', async () => {
    vi.mocked(billingApi.checkout).mockRejectedValueOnce({ response: { status: 409, data: { error: 'consent_outdated' } } })
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    act(() => result.current.setConsent(true))
    await act(() => result.current.buy())
    expect(result.current.error).toBe('consentOutdated')
    vi.mocked(billingApi.checkout).mockRejectedValueOnce({ response: { status: 503, data: { error: 'billing_disabled' } } })
    await act(() => result.current.buy())
    expect(result.current.error).toBe('generic')
    expect(openCheckout).not.toHaveBeenCalled()
  })

  it('FE-PAGE-PRICING-HOOK-005: 讀不到方案、從付款頁取消回來', async () => {
    search = 'canceled=1'
    vi.mocked(billingApi.plan).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.loadFailed).toBe(true))
    expect(result.current.canceled).toBe(true)
    expect(result.current.enabled).toBe(false)
  })

  it('FE-PAGE-PRICING-HOOK-006: 100% 優惠碼 → 伺服器回 url null，直接到付款完成頁', async () => {
    vi.mocked(billingApi.checkout).mockResolvedValueOnce({ url: null, ref: 'free-ref' })
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    act(() => { result.current.setConsent(true); result.current.setPromoCode('FREE100') })
    await act(() => result.current.buy())
    expect(billingApi.checkout).toHaveBeenCalledWith('2026-10-20', 'FREE100')
    expect(navigate).toHaveBeenCalledWith('/billing/success?ref=free-ref')
    expect(openCheckout).not.toHaveBeenCalled()
  })

  it('FE-PAGE-PRICING-HOOK-007: 優惠碼用完／過期 → 對應的錯誤', async () => {
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    act(() => result.current.setConsent(true))
    vi.mocked(billingApi.checkout).mockRejectedValueOnce({ response: { status: 400, data: { error: 'promo_used_up' } } })
    await act(() => result.current.buy())
    expect(result.current.error).toBe('promoUsedUp')
    vi.mocked(billingApi.checkout).mockRejectedValueOnce({ response: { status: 400, data: { error: 'promo_expired' } } })
    await act(() => result.current.buy())
    expect(result.current.error).toBe('promoExpired')
  })

  it('FE-PAGE-PRICING-HOOK-008: 免費主揪 → canOpenFree，可以回首頁開團', async () => {
    vi.mocked(billingApi.me).mockResolvedValueOnce({ needs_purchase: false, free_organizer: true })
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.canOpenFree).toBe(true))
    expect(result.current.freeOrganizer).toBe(true)
    act(() => result.current.goDashboard())
    expect(navigate).toHaveBeenCalledWith('/dashboard')
  })
})
