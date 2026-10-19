import type { CSSProperties } from 'react'
import { useAppName } from '../../utils/appName'

/**
 * The ENSCON Trip Studio lockup.
 *
 * Inline rather than an `<img>` so it inherits `currentColor` and follows the
 * theme's ink instead of needing a second, light-on-dark copy. It is plain text
 * in a single colour.
 */
export function StudioWordmark({ style, title }: { style?: CSSProperties; title?: string }) {
  const appName = useAppName()
  const label = title ?? `${appName} Studio`
  return (
    <svg
      viewBox="0 0 560 110"
      fill="currentColor"
      role="img"
      aria-label={label}
      style={{ display: 'block', ...style }}
    >
      <text
        x="0"
        y="82"
        fontFamily="'Space Grotesk', 'PingFang TC', 'Noto Sans TC', system-ui, sans-serif"
        fontWeight="800"
        fontSize="80"
      >
        {label}
      </text>
    </svg>
  )
}
