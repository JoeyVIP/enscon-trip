import type { TranslationStrings } from '../types';

// 伴手禮／代購清單專用 namespace，獨立成檔避免和其他功能的 i18n 衝突
const twSouvenir: TranslationStrings = {
  'twSouvenir.tab': 'Souvenirs',
  'twSouvenir.title': 'Souvenir & errand list',
  'twSouvenir.viewRecipient': 'By recipient',
  'twSouvenir.viewBuyer': 'By buyer',
  'twSouvenir.progress': 'Bought {bought}/{total}',
  'twSouvenir.addItem': 'Add item',
  'twSouvenir.name': 'Item',
  'twSouvenir.quantity': 'Qty',
  'twSouvenir.recipient': 'For',
  'twSouvenir.buyer': 'Bought by',
  'twSouvenir.store': 'Store / place',
  'twSouvenir.price': 'Est. price (JPY)',
  'twSouvenir.unassigned': 'Unassigned',
  'twSouvenir.noRecipient': 'No recipient',
  'twSouvenir.empty': 'No souvenir items yet. Add one, or create the starter list.',
  'twSouvenir.createTemplate': 'Create souvenir list',
  'twSouvenir.templateHint': 'Pre-fills common categories only. Tax-free rules depend on the store and the system in force at the time.',
  'twSouvenir.cat.cosmetics': 'Drugstore & beauty',
  'twSouvenir.cat.snacks': 'Snacks',
  'twSouvenir.cat.daily': 'Daily goods',
  'twSouvenir.cat.gifts': 'Keepsakes',
  'twSouvenir.delete': 'Delete',
  'twSouvenir.namePlaceholder': 'e.g. snacks, medicine',
  'twSouvenir.recipientPlaceholder': 'Name or pick a member',
  'twSouvenir.storePlaceholder': 'e.g. Don Quijote, drugstore',
};
export default twSouvenir;
