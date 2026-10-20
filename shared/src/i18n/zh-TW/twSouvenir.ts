import type { TranslationStrings } from '../types';

// 伴手禮／代購清單專用 namespace，獨立成檔避免和其他功能的 i18n 衝突
const twSouvenir: TranslationStrings = {
  'twSouvenir.tab': '伴手禮',
  'twSouvenir.title': '伴手禮／代購清單',
  'twSouvenir.viewRecipient': '依「給誰」',
  'twSouvenir.viewBuyer': '依「誰去買」',
  'twSouvenir.progress': '已買 {bought}／共 {total}',
  'twSouvenir.addItem': '新增品項',
  'twSouvenir.name': '品名',
  'twSouvenir.quantity': '數量',
  'twSouvenir.recipient': '給誰',
  'twSouvenir.buyer': '誰去買',
  'twSouvenir.store': '店家／地點',
  'twSouvenir.price': '預估日圓價',
  'twSouvenir.unassigned': '未指派',
  'twSouvenir.noRecipient': '未填給誰',
  'twSouvenir.empty': '還沒有伴手禮品項，可以新增，或一鍵建立範本清單。',
  'twSouvenir.createTemplate': '建立伴手禮清單',
  'twSouvenir.templateHint': '只預填常見分類，不含商品與價格。免稅規則以店家與當時制度為準。',
  'twSouvenir.cat.cosmetics': '藥妝',
  'twSouvenir.cat.snacks': '零食',
  'twSouvenir.cat.daily': '日用',
  'twSouvenir.cat.gifts': '紀念品',
  'twSouvenir.delete': '刪除',
  'twSouvenir.namePlaceholder': '例：零食、藥品',
  'twSouvenir.recipientPlaceholder': '輸入名字或選成員',
  'twSouvenir.storePlaceholder': '例：唐吉訶德、藥妝店',
  'twSouvenir.storeTotals': '各店預估合計',
  'twSouvenir.taxFreeHint': '日本免稅（2026/11/1 起改出境退稅）：同一家店、同一天合計滿 5,000 円（未稅）才能辦。這裡用你填的預估價加總，實際以店家為準。',
};
export default twSouvenir;
