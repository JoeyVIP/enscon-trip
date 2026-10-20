// FE-TW-COVERART-001 onwards
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import TripCoverArt, { TripCoverScene, TripCoverSky } from './TripCoverArt'

describe('TripCoverArt', () => {
  it('FE-TW-COVERART-001: draws the scene the trip name calls for, hidden from screen readers', () => {
    const { container } = render(<div style={{ position: 'relative' }}><TripCoverArt tripId={5} title="沖繩跨年" /></div>)

    const art = container.querySelector('[data-testid="trip-cover-art"]') as HTMLElement
    expect(art).toHaveAttribute('aria-hidden', 'true')
    expect(art.querySelector('svg[data-motif="sea"]')).toBeInTheDocument()
    // The sky carries the tone class the CSS keys its colours (and .dark) on.
    expect(art.querySelector('.tca-sky.tca-soft')).toBeInTheDocument()
  })

  it('FE-TW-COVERART-002: the same trip always draws the same picture', () => {
    const a = render(<TripCoverScene tripId={12} title="Tokyo" />).container.innerHTML
    const b = render(<TripCoverScene tripId={12} title="Tokyo" />).container.innerHTML
    const other = render(<TripCoverScene tripId={13} title="Tokyo" />).container.innerHTML
    expect(a).toBe(b)
    expect(other).not.toBe(a)
  })

  it('FE-TW-COVERART-003: every motif renders shapes in both tones', () => {
    for (const title of ['Okinawa', 'Alps', 'Paris', 'Somewhere']) {
      for (const tone of ['soft', 'deep'] as const) {
        const { container, unmount } = render(<TripCoverScene tripId={3} title={title} tone={tone} />)
        const svg = container.querySelector('svg') as SVGElement
        expect(svg.getAttribute('class')).toContain(`tca-${tone}`)
        expect(svg.querySelectorAll('path, rect, circle').length).toBeGreaterThan(2)
        // No NaN slipped into the generated geometry.
        expect(container.innerHTML).not.toContain('NaN')
        unmount()
      }
    }
  })

  it('FE-TW-COVERART-004: the sky has a sun and clouds and never inline colours', () => {
    const { container } = render(<TripCoverSky tripId={9} tone="deep" />)
    expect(container.querySelectorAll('circle').length).toBe(2)
    expect(container.querySelectorAll('rect').length).toBe(3)
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i)
  })
})
