import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import MCostsTab from '../../../../src/mobile/screens/trip/tabs/MCostsTab'
import type { TripPlanner } from '../../../../src/mobile/screens/trip/MTripShell'
import { clearExchangeRateCache } from '../../../../src/hooks/useExchangeRates'
import { resetTwdRateCache } from '../../../../src/hooks/useTwdRate'
import { useAuthStore } from '../../../../src/store/authStore'
import { useSettingsStore } from '../../../../src/store/settingsStore'
import type { BudgetItem, Trip } from '../../../../src/types'
import { buildTrip, buildUser } from '../../../helpers/factories'
import { buildPlanner, buildShell } from '../../../helpers/mobileTrip'
import { resetAllStores, seedStore } from '../../../helpers/store'
import { server } from '../../../helpers/msw/server'
import { render, screen, waitFor } from '../../../helpers/render'

// 記帳換匯：手機版 Costs 的新台幣對照

const FX_URL = 'https://api.frankfurter.dev/v2/rates'
const MEMBERS = [
  { id: 1, username: '小美', avatar_url: null },
  { id: 2, username: '小明', avatar_url: null },
]
const RAMEN = {
  id: 11, trip_id: 7, name: 'Ramen', category: 'food', total_price: 6000, currency: 'JPY',
  expense_date: '2026-12-02', note: null,
  members: [{ user_id: 1, paid: 1, username: '小美', amount: null, avatar_url: null }, { user_id: 2, paid: 0, username: '小明', amount: null, avatar_url: null }],
  payers: [{ user_id: 1, amount: 6000, username: '小美' }],
} as unknown as BudgetItem

function setup(currency: string) {
  const trip = buildTrip({ id: 7, title: 'Okinawa', currency }) as Trip
  seedStore(useSettingsStore, { settings: { ...useSettingsStore.getState().settings, default_currency: currency } })
  server.use(http.get('/api/trips/:id/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })))
  const p = buildPlanner({
    tripId: 7, trip, days: [], budgetItems: [{ ...RAMEN, currency }],
    tripMembers: MEMBERS as unknown as TripPlanner['tripMembers'],
  })
  return render(<MCostsTab planner={p} shell={buildShell()} />)
}

describe('MCostsTab — 新台幣對照', () => {
  beforeEach(() => {
    resetAllStores()
    clearExchangeRateCache()
    resetTwdRateCache()
    seedStore(useAuthStore, { user: buildUser({ id: 1, username: '小美' }) })
  })

  it('日圓：每筆與總額旁顯示 ≈ NT$，並有匯率小字', async () => {
    server.use(http.get(FX_URL, ({ request }) => new URL(request.url).searchParams.get('base') === 'JPY'
      ? HttpResponse.json([{ date: '2026-10-19', base: 'JPY', quote: 'TWD', rate: 0.2 }])
      : HttpResponse.json([])))
    setup('JPY')
    await waitFor(() => expect(screen.getAllByText('≈ NT$ 1,200').length).toBeGreaterThanOrEqual(2))
    expect(screen.getByTestId('twd-rate-note')).toBeInTheDocument()
  })

  it('匯率抓不到：不顯示 ≈ NT$，只給提示', async () => {
    server.use(http.get(FX_URL, () => HttpResponse.error()))
    setup('JPY')
    await waitFor(() => expect(screen.getByTestId('twd-rate-note')).toBeInTheDocument())
    expect(screen.queryByTestId('twd-approx')).toBeNull()
  })

  it('TWD：完全不顯示換算', async () => {
    setup('TWD')
    await screen.findByText('Ramen')
    expect(screen.queryByTestId('twd-approx')).toBeNull()
    expect(screen.queryByTestId('twd-rate-note')).toBeNull()
  })
})
