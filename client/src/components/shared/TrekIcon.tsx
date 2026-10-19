import type { SVGProps } from 'react'

/**
 * The ENSCON Trip square app icon (four tilted arcs), from public/icons/icon.svg.
 * The wordmark with the API pill is `TrekMark`. The component keeps its old name
 * because it is an internal identifier; what it draws is our mark.
 *
 * Inlined rather than loaded as an <img> so it takes `currentColor` and follows
 * the theme like the provider glyphs it sits next to in the document-sync flow.
 * Monochrome: the arcs are `currentColor`, the lighter two at reduced opacity,
 * and the gaps between them use the card background.
 */
export default function TrekIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  const gap = 'var(--bg-card, #fff)'
  return (
    <svg viewBox="0 0 1024 1024" aria-hidden className={className} {...props}>
      <g transform="translate(-317.7 -217.3) scale(1.8944)">
        <g transform="rotate(-6 275 408)">
          <ellipse cx="275" cy="408" rx="46" ry="119" fill={gap} />
          <ellipse cx="275" cy="408" rx="40" ry="113" fill="currentColor" />
        </g>
        <g transform="rotate(-6 355 401)">
          <ellipse cx="355" cy="401" rx="58" ry="141" fill={gap} />
          <ellipse cx="355" cy="401" rx="52" ry="135" fill="currentColor" fillOpacity=".5" />
        </g>
        <g transform="rotate(-6 442 393)">
          <ellipse cx="442" cy="393" rx="69" ry="167" fill={gap} />
          <ellipse cx="442" cy="393" rx="63" ry="161" fill="currentColor" />
        </g>
        <g transform="rotate(-6 562 384)">
          <ellipse cx="562" cy="384" rx="86" ry="201" fill={gap} />
          <ellipse cx="562" cy="384" rx="80" ry="195" fill="currentColor" fillOpacity=".5" />
        </g>
      </g>
    </svg>
  )
}
