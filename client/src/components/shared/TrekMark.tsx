import React from 'react'

/**
 * The ENSCON Trip wordmark, including the pill.
 *
 * `fill="currentColor"` on the mark and the two pill classes below are what let
 * one file serve both themes: the letters take the surrounding text colour, the
 * pill inverts against it. No second asset, no dark-mode variant to keep in
 * sync, and it stays correct if the accent or the surface ever changes.
 */
/**
 * `pill={false}` draws the word alone, for the places where the product itself is meant
 * rather than its index: the viewBox then ends where the word does.
 */
export default function TrekMark({ pill = true, ...props }: React.SVGProps<SVGSVGElement> & { pill?: boolean }): React.ReactElement {
  return (
    <>
      <style>{`
        .trek-mark .pill-bg { fill: currentColor; }
        .trek-mark .pill-fg { fill: var(--bg-card); }
      `}</style>
      <svg aria-label="ENSCON Trip Places API" {...props} className={`trek-mark ${props.className ?? ''}`} xmlns="http://www.w3.org/2000/svg" viewBox={pill ? '0 0 860 110' : '0 0 500 110'} fill="currentColor" role="img">
        <text x="0" y="84" fontFamily="'Space Grotesk', 'PingFang TC', 'Noto Sans TC', system-ui, sans-serif" fontWeight="800" fontSize="84">ENSCON Trip</text>
        {pill && (
          <>
            <rect className="pill-bg" x="530" y="14" width="330" height="86" rx="43" />
            <text className="pill-fg" x="695" y="76" textAnchor="middle" fontFamily="'Space Grotesk', system-ui, sans-serif" fontWeight="700" fontSize="48">Places API</text>
          </>
        )}
      </svg>
    </>
  )
}
