import React from 'react'
import { seededRandom, tripCoverMotif, type TripCoverMotif } from '../../utils/tripCoverMotif'
import '../../styles/tripCoverArt.css'

/**
 * The picture a trip shows while it has no cover photo: a soft sky in the
 * ENSCON blues (#02539C / #B3CBE1 / #F2F6FA) over a small scene picked from
 * the trip's name — waves for an island trip, ridges for the mountains, a
 * skyline for a city, rolling hills and a dotted route otherwise. Replaces the
 * random rainbow gradient, which on a phone read as an empty box.
 *
 * Colours live in tripCoverArt.css as custom properties, so the `.dark` class
 * swaps them without the component knowing the theme.
 *
 *   soft — light sky with dark ink on top (the phone spotlight card)
 *   deep — navy sky that keeps white text and the glass buttons legible
 *          (desktop hero, trip cards)
 */
export type TripCoverTone = 'soft' | 'deep'

interface ArtProps {
  tripId: number
  title?: string | null
  description?: string | null
  tone?: TripCoverTone
  className?: string
}

const r1 = (n: number): number => Math.round(n * 10) / 10

/** A filled band whose top edge is a sine-like wave (quadratic + smooth T segments). */
function wave(y: number, amp: number, wl: number, phase: number): string {
  const x0 = r1(-wl * (1 + phase))
  let d = `M${x0} ${y} Q${r1(x0 + wl / 4)} ${r1(y - amp)} ${r1(x0 + wl / 2)} ${y}`
  for (let x = x0 + wl; x <= 560; x += wl / 2) d += ` T${r1(x)} ${y}`
  return `${d} V100 H${x0} Z`
}

function SeaScene({ rand }: { rand: () => number }): React.ReactElement {
  const ix = 50 + rand() * 210
  const iw = 70 + rand() * 50
  // A small sailboat beside the island, on whichever side has room.
  const right = ix + iw + 30 + rand() * 60
  const bx = right <= 360 ? right : Math.max(16, ix - 40)
  return (
    <>
      <path className="tca-far" d={`M${r1(ix)} 64 Q${r1(ix + iw * 0.35)} ${r1(34 + rand() * 8)} ${r1(ix + iw * 0.6)} 52 Q${r1(ix + iw * 0.8)} 44 ${r1(ix + iw)} 64 Z`} />
      <path className="tca-far" d={wave(64, 3, 70, rand())} />
      <path className="tca-mid" d={`M${r1(bx)} 70 l0 -17 l11 17 Z M${r1(bx - 3)} 71 h17 l-3 3 h-12 Z`} />
      <path className="tca-mid" d={wave(76, 4.5, 104, rand())} />
      <path className="tca-near" d={wave(88, 5, 138, rand())} />
    </>
  )
}

function MountainScene({ rand }: { rand: () => number }): React.ReactElement {
  const peaks = Array.from({ length: 4 }, (_, i) => ({
    cx: -10 + i * 120 + rand() * 60,
    cy: 22 + rand() * 26,
    w: 70 + rand() * 40,
  }))
  return (
    <>
      {peaks.map((p, i) => {
        const f = 0.24
        const h = 100 - p.cy
        const lx = r1(p.cx - p.w * f), rx = r1(p.cx + p.w * f), y = r1(p.cy + h * f)
        return (
          <g key={i}>
            <path className="tca-far" d={`M${r1(p.cx - p.w)} 100 L${r1(p.cx)} ${r1(p.cy)} L${r1(p.cx + p.w)} 100 Z`} />
            <path className="tca-snow" d={`M${r1(p.cx)} ${r1(p.cy)} L${rx} ${y} L${r1(p.cx + p.w * f * 0.35)} ${r1(y - h * 0.05)} L${r1(p.cx - p.w * f * 0.1)} ${r1(y + h * 0.02)} L${r1(p.cx - p.w * f * 0.5)} ${r1(y - h * 0.04)} L${lx} ${y} Z`} />
          </g>
        )
      })}
      <path className="tca-mid" d={wave(80, 6, 170, rand())} />
      <path className="tca-near" d={wave(92, 3.5, 210, rand())} />
    </>
  )
}

function CityScene({ rand }: { rand: () => number }): React.ReactElement {
  const row = (top: number, minH: number, maxH: number, minW: number, maxW: number): Array<[number, number, number]> => {
    const out: Array<[number, number, number]> = []
    for (let x = -30; x < 440;) {
      const w = minW + rand() * (maxW - minW)
      out.push([x, w, top - (minH + rand() * (maxH - minH))])
      x += w + 2
    }
    return out
  }
  const far = row(100, 26, 58, 14, 28)
  const mid = row(100, 12, 34, 20, 38)
  // One landmark tower in the far row, somewhere in the middle third.
  const tx = 140 + rand() * 120
  const rect = ([x, w, y]: [number, number, number]) => `M${r1(x)} 100 V${r1(y)} H${r1(x + w)} V100 Z`
  return (
    <>
      <path className="tca-far" d={far.map(rect).join(' ')} />
      <path className="tca-far" d={`M${r1(tx)} 100 V34 L${r1(tx + 4)} 30 V18 h1.6 V30 L${r1(tx + 9.6)} 34 V100 Z`} />
      <path className="tca-mid" d={mid.map(rect).join(' ')} />
      <g className="tca-win">
        {mid.filter((_, i) => i % 2 === 0).flatMap(([x, w, y], i) => (
          Array.from({ length: Math.max(1, Math.floor((100 - y - 12) / 7)) }, (_, j) => (
            <rect key={`${i}-${j}`} x={r1(x + w / 2 - 3.5)} y={r1(y + 5 + j * 7)} width="2.4" height="2.4" />
          ))
        ))}
      </g>
      <rect className="tca-near" x="-40" y="93" width="520" height="7" />
    </>
  )
}

function TravelScene({ rand }: { rand: () => number }): React.ReactElement {
  const y1 = 64 + rand() * 10
  const y2 = 30 + rand() * 14
  return (
    <>
      <path className="tca-far" d={wave(70, 8, 230, rand())} />
      <path className="tca-route" d={`M40 ${r1(y1)} C130 ${r1(y2 - 10)}, 230 ${r1(y1 + 12)}, 344 ${r1(y2 + 8)}`} strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" />
      <circle className="tca-pin" cx="40" cy={r1(y1)} r="3" />
      <path className="tca-pin" d={`M344 ${r1(y2 + 8)} c-5 -6 -7 -9 -7 -12.5 a7 7 0 0 1 14 0 c0 3.5 -2 6.5 -7 12.5 Z`} />
      <circle className="tca-sun" cx="344" cy={r1(y2 - 4.5)} r="2.6" />
      <path className="tca-mid" d={wave(82, 7, 172, rand())} />
      <path className="tca-near" d={wave(93, 4, 236, rand())} />
    </>
  )
}

const SCENES: Record<TripCoverMotif, (p: { rand: () => number }) => React.ReactElement> = {
  sea: SeaScene,
  mountain: MountainScene,
  city: CityScene,
  travel: TravelScene,
}

/** The sky: gradient plus a sun and two clouds, top-right. Absolutely fills its parent. */
export function TripCoverSky({ tripId, tone = 'soft', className = '' }: Pick<ArtProps, 'tripId' | 'tone' | 'className'>): React.ReactElement {
  const rand = seededRandom(tripId * 7 + 3)
  const sx = r1(128 + rand() * 40)
  const sy = r1(46 + rand() * 18)
  const c1x = r1(20 + rand() * 50)
  const c2x = r1(90 + rand() * 30)
  return (
    <div aria-hidden className={`tca tca-${tone} tca-sky pointer-events-none absolute inset-0 ${className}`}>
      <svg className="absolute right-0 top-0 h-full w-[62%] max-w-[300px]" viewBox="0 0 200 120" preserveAspectRatio="xMaxYMin meet">
        <circle className="tca-halo" cx={sx} cy={sy} r="27" />
        <circle className="tca-sun" cx={sx} cy={sy} r="17" />
        <rect className="tca-cloud" x={c1x} y="30" width="46" height="9" rx="4.5" />
        <rect className="tca-cloud" x={r1(c1x + 14)} y="24" width="22" height="9" rx="4.5" />
        <rect className="tca-cloud" x={c2x} y="78" width="34" height="7" rx="3.5" />
      </svg>
    </div>
  )
}

/** The ground scene, drawn into a 400×100 box and cropped to fill its own width and height. */
export function TripCoverScene({ tripId, title, description, tone = 'soft', className = '' }: ArtProps): React.ReactElement {
  const motif = tripCoverMotif(title, description)
  const Scene = SCENES[motif]
  return (
    <svg
      aria-hidden
      data-motif={motif}
      className={`tca tca-${tone} pointer-events-none ${className}`}
      viewBox="0 0 400 100"
      preserveAspectRatio="xMidYMax slice"
    >
      <Scene rand={seededRandom(tripId)} />
    </svg>
  )
}

/** Sky + scene filling the parent (which must be positioned). */
export default function TripCoverArt({ className = '', ...props }: ArtProps): React.ReactElement {
  return (
    <div aria-hidden data-testid="trip-cover-art" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <TripCoverSky tripId={props.tripId} tone={props.tone} />
      <TripCoverScene {...props} className="absolute bottom-0 left-0 block h-[46%] w-full" />
    </div>
  )
}
