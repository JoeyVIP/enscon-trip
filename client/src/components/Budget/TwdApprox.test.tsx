import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { resetTwdRateCache } from '../../hooks/useTwdRate'
import type { TwdRateState } from '../../hooks/useTwdRate'
import { TwdApprox, TwdRateNote } from './TwdApprox'
import { TwdEntry } from './TwdEntry'
import { useState } from 'react'

const live: TwdRateState = { status: 'live', base: 'JPY', rate: 0.2, date: '2026-10-19' }

describe('TwdApprox / TwdRateNote', () => {
  it('顯示 ≈ NT$ 金額', () => {
    render(<TwdApprox amount={6000} fx={live} />)
    expect(screen.getByTestId('twd-approx').textContent).toBe('≈ NT$ 1,200')
  })

  it('hidden（行程貨幣是台幣）／loading／error 都不畫金額', () => {
    for (const status of ['hidden', 'loading', 'error'] as const) {
      const { unmount } = render(<TwdApprox amount={6000} fx={{ ...live, status, rate: null }} />)
      expect(screen.queryByTestId('twd-approx')).toBeNull()
      unmount()
    }
  })

  it('匯率小字：live、offline、error 三種說明', () => {
    const { rerender } = render(<TwdRateNote fx={live} />)
    expect(screen.getByTestId('twd-rate-note').textContent).toContain('1 JPY = 0.2 TWD')
    expect(screen.getByTestId('twd-rate-note').textContent).toContain('2026-10-19')
    rerender(<TwdRateNote fx={{ ...live, status: 'offline', date: '2026-10-01' }} />)
    expect(screen.getByTestId('twd-rate-note').textContent).toMatch(/Offline.*2026-10-01/)
    rerender(<TwdRateNote fx={{ ...live, status: 'error', rate: null }} />)
    expect(screen.getByTestId('twd-rate-note').textContent).toMatch(/temporarily unavailable/)
    rerender(<TwdRateNote fx={{ ...live, status: 'hidden', rate: null }} />)
    expect(screen.queryByTestId('twd-rate-note')).toBeNull()
  })
})

describe('TwdEntry（用台幣輸入）', () => {
  function Harness({ currency }: { currency: string }) {
    const [v, setV] = useState('')
    return <div><TwdEntry currency={currency} onFill={setV} /><output data-testid="filled">{v}</output></div>
  }

  it('輸入 NT$ 依匯率換成行程貨幣填入', async () => {
    resetTwdRateCache()
    server.use(http.get('https://api.frankfurter.dev/v2/rates', () => HttpResponse.json([{ date: '2026-10-19', quote: 'TWD', rate: 0.2 }])))
    render(<Harness currency="JPY" />)
    await userEvent.click(await screen.findByRole('button', { name: /TWD/i }))
    await userEvent.type(screen.getByPlaceholderText(/NT\$/), '1000')
    expect(screen.getByTestId('filled').textContent).toBe('5000') // 1000 / 0.2，日圓 0 位小數
  })

  it('幣別是台幣時不顯示按鈕', () => {
    render(<Harness currency="TWD" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
