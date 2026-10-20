import type { TranslationStrings } from '../types';

// Taiwan fork: short captions under the phone dock icons, and the Collab tab name (own namespace).
// twNav.collab keeps this locale's existing collab addon name, so nothing regresses here.
const twNav: TranslationStrings = {
  'twNav.dock.plan': 'Plan',
  'twNav.dock.roadtrip': 'Drive',
  'twNav.dock.transports': 'Transit',
  'twNav.dock.bookings': 'Bookings',
  'twNav.dock.budget': 'Costs',
  'twNav.dock.lists': 'Lists',
  'twNav.collab': 'Col·laboració',
};
export default twNav;
