// 記帳換匯：Costs 桌面版的新台幣對照
import { render, screen, waitFor } from '../../../tests/helpers/render'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { useAuthStore } from '../../store/authStore'
import { useTripStore } from '../../store/tripStore'
import { useSettingsStore } from '../../store/settingsStore'
import { clearExchangeRateCache } from '../../hooks/useExchangeRates'
import { resetTwdRateCache } from '../../hooks/useTwdRate'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { buildUser, buildTrip, buildBudgetItem } from '../../../tests/helpers/factories'
import CostsPanel from './CostsPanel'

const members = [
  { id: 1, username: '小美', avatar_url: null },
  { id: 2, username: '小明', avatar_url: null },
]
const FX_URL = 'https://api.frankfurter.dev/v2/rates'

function serve(currency: string) {
  const item = { ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Ramen', currency }), total_price: 6000, expense_date: '2026-12-02' }
  server.use(
    http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
    http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
  )
}

beforeEach(() => {
  resetAllStores()
  clearExchangeRateCache()
  resetTwdRateCache()
  seedStore(useAuthStore, { user: buildUser({ id: 1 }), isAuthenticated: true })
})

describe('CostsPanel — 新台幣對照', () => {
  it('日圓行程：每筆與總額旁有 ≈ NT$，並顯示匯率來源與日期', async () => {
    seedStore(useTripStore, { trip: buildTrip({ id: 1, currency: 'JPY' }) })
    seedStore(useSettingsStore, { settings: { ...useSettingsStore.getState().settings, default_currency: 'JPY' } })
    serve('JPY')
    server.use(http.get(FX_URL, ({ request }) => {
      if (new URL(request.url).searchParams.get('base') !== 'JPY') return HttpResponse.json([])
      return HttpResponse.json([{ date: '2026-10-19', base: 'JPY', quote: 'TWD', rate: 0.2 }])
    }))
    render(<CostsPanel tripId={1} tripMembers={members} />)
    await screen.findByText('Ramen')
    await waitFor(() => expect(screen.getAllByTestId('twd-approx').length).toBeGreaterThan(0))
    expect(screen.getAllByText('≈ NT$ 1,200').length).toBeGreaterThanOrEqual(2) // 該筆 + 總額
    expect(screen.getByTestId('twd-rate-note').textContent).toContain('1 JPY = 0.2 TWD')
    expect(screen.getByTestId('twd-rate-note').textContent).toContain('2026-10-19')
  })

  it('匯率抓不到：顯示「暫時抓不到」而不是亂顯示', async () => {
    seedStore(useTripStore, { trip: buildTrip({ id: 1, currency: 'JPY' }) })
    seedStore(useSettingsStore, { settings: { ...useSettingsStore.getState().settings, default_currency: 'JPY' } })
    serve('JPY')
    server.use(http.get(FX_URL, () => HttpResponse.error()))
    render(<CostsPanel tripId={1} tripMembers={members} />)
    await screen.findByText('Ramen')
    await waitFor(() => expect(screen.getByTestId('twd-rate-note').textContent).toMatch(/temporarily unavailable/))
    expect(screen.queryByTestId('twd-approx')).toBeNull()
  })

  it('行程（顯示）貨幣是 TWD：不顯示換算也不打匯率 API', async () => {
    let calls = 0
    seedStore(useTripStore, { trip: buildTrip({ id: 1, currency: 'TWD' }) })
    seedStore(useSettingsStore, { settings: { ...useSettingsStore.getState().settings, default_currency: 'TWD' } })
    serve('TWD')
    server.use(http.get(FX_URL, () => { calls++; return HttpResponse.json([]) }))
    render(<CostsPanel tripId={1} tripMembers={members} />)
    await screen.findByText('Ramen')
    expect(screen.queryByTestId('twd-approx')).toBeNull()
    expect(screen.queryByTestId('twd-rate-note')).toBeNull()
    expect(calls).toBe(0)
  })
})
