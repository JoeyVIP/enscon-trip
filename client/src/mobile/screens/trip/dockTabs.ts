import { Map as MapIcon, TrainFront, Ticket, Wallet, PackageCheck, Route } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Which trip sections get a seat in the phone dock, and in which order.
 *
 * The dock is a fixed 62px pill with `justify-around` and no overflow, so seats are
 * a real budget, not a preference: at 375px it measures 343px, 315px of it usable,
 * and every seat used to be a 42px circle. Five sections plus More leave 9px between
 * them. A sixth takes that down to 3px, which is not a gap any thumb can aim at.
 *
 * Hence DOCK_CAP. Everything past it surfaces as a tile in the More sheet, which is
 * where files, collaboration and plugin tabs have always lived.
 *
 * This list is the ONE source for both sides. It used to be two hand-kept copies
 * (one here, one in MMehrSheet), and extending only one of them showed the same tab
 * in the dock AND as a tile.
 *
 * Taiwan fork: each seat now carries a short caption under its icon, so a seat is a
 * flexible column (at least 42px wide, at most 56px) instead of a fixed circle. Six
 * seats still fit from 320px up without any of them dropping under 42px.
 */
export interface DockTab {
  id: string
  icon: LucideIcon
  /** Short caption under the icon (twNav namespace). The full tab name stays the aria-label. */
  labelKey: string
}

export const DOCK_PRIORITY: DockTab[] = [
  { id: 'plan', icon: MapIcon, labelKey: 'twNav.dock.plan' },
  { id: 'roadtrip', icon: Route, labelKey: 'twNav.dock.roadtrip' },
  { id: 'transports', icon: TrainFront, labelKey: 'twNav.dock.transports' },
  { id: 'buchungen', icon: Ticket, labelKey: 'twNav.dock.bookings' },
  { id: 'finanzplan', icon: Wallet, labelKey: 'twNav.dock.budget' },
  { id: 'listen', icon: PackageCheck, labelKey: 'twNav.dock.lists' },
]

/** Seats beside the More button. */
export const DOCK_CAP = 5

/**
 * The dock's seats for a trip, given the tabs that are actually enabled.
 *
 * Priority order decides who is cut, not enabled order: with the road trip addon on,
 * the packing list moves into the More sheet rather than the drive never getting a
 * seat. Turning the addon off puts it straight back.
 */
export function pickDockTabs(enabledTabIds: ReadonlySet<string>): DockTab[] {
  return DOCK_PRIORITY.filter(tab => enabledTabIds.has(tab.id)).slice(0, DOCK_CAP)
}

/** The ids that got a seat, for the More sheet to leave out. */
export function dockTabIds(enabledTabIds: ReadonlySet<string>): Set<string> {
  return new Set(pickDockTabs(enabledTabIds).map(tab => tab.id))
}
