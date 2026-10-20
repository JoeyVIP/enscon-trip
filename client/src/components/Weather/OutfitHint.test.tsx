import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../../tests/helpers/render'
import { resetAllStores } from '../../../tests/helpers/store'
import { OutfitHint } from './OutfitHint'

beforeEach(() => { resetAllStores() })

describe('OutfitHint', () => {
  it('FE-COMP-OUTFITHINT-001: 有天氣資料時顯示穿衣小字', () => {
    render(<OutfitHint weather={{ temp: 20, temp_max: 24, temp_min: 18, precipitation_probability_max: 70 }} />)
    expect(screen.getByTestId('outfit-hint')).toBeInTheDocument()
  })

  it('FE-COMP-OUTFITHINT-002: 沒有天氣資料或帶 error 時不顯示', () => {
    const { container, rerender } = render(<OutfitHint weather={null} />)
    expect(container.firstChild).toBeNull()
    rerender(<OutfitHint weather={{ temp: 0, error: 'no_forecast' }} />)
    expect(screen.queryByTestId('outfit-hint')).toBeNull()
  })
})
