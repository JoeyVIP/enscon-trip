import type { TranslationStrings } from '../types';

// 台灣在地化：貼上文字自動排行程（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twImport: TranslationStrings = {
  'twImport.entry': 'Paste text to auto-plan',
  'twImport.title': 'Paste text, auto-plan the days',
  'twImport.placeholder': 'Paste the itinerary your group chat has been discussing…',
  'twImport.remaining': '{n} characters left',
  'twImport.privacy': 'Text is sent to AI for parsing. Please do not paste booking codes or ID numbers.',
  'twImport.parse': 'Parse',
  'twImport.parsing': 'Parsing…',
  'twImport.reparse': 'Let AI parse it again',
  'twImport.previewHint': 'Check the stops below, edit names or times, and untick anything you do not want.',
  'twImport.dayHeader': 'Day {n}',
  'twImport.unassigned': 'Unassigned',
  'twImport.assignPrompt': 'Pick a day',
  'twImport.skip': 'Skip',
  'twImport.add': 'Add {n} stops to trip',
  'twImport.adding': 'Adding…',
  'twImport.added': 'Added {n} stops',
  'twImport.error': 'Could not parse or add the text. Please try again.',
  'twImport.addFailed': 'Could not add the stops. Nothing was changed in your trip, so you can simply try again.',
  'twImport.llmOff': 'AI parsing is not enabled on this server',
  'twImport.rateLimited': 'Too many attempts. Please try again in an hour.',
  'twImport.empty': 'Nothing to import yet',
  'twImport.name': 'Stop name',
  'twImport.time': 'Time',
  'twImport.close': 'Close',
  'twImport.back': 'Edit text',
  'twImport.noResult': 'No stops were found in this text',
};

export default twImport;
