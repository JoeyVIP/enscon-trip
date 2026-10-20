import type { TranslationStrings } from '../types';

// 伴手礼／代购清单专用 namespace（zh = 简体中文；繁中在 zh-TW）
const twSouvenir: TranslationStrings = {
  'twSouvenir.tab': '伴手礼',
  'twSouvenir.title': '伴手礼／代购清单',
  'twSouvenir.viewRecipient': '按「给谁」',
  'twSouvenir.viewBuyer': '按「谁去买」',
  'twSouvenir.progress': '已买 {bought}／共 {total}',
  'twSouvenir.addItem': '新增物品',
  'twSouvenir.name': '品名',
  'twSouvenir.quantity': '数量',
  'twSouvenir.recipient': '给谁',
  'twSouvenir.buyer': '谁去买',
  'twSouvenir.store': '店家／地点',
  'twSouvenir.price': '预估日元价',
  'twSouvenir.unassigned': '未指派',
  'twSouvenir.noRecipient': '未填给谁',
  'twSouvenir.empty': '还没有伴手礼物品，可以新增，或一键建立模板清单。',
  'twSouvenir.createTemplate': '建立伴手礼清单',
  'twSouvenir.templateHint': '只预填常见分类，不含商品与价格。免税规则以店家与当时制度为准。',
  'twSouvenir.cat.cosmetics': '药妆',
  'twSouvenir.cat.snacks': '零食',
  'twSouvenir.cat.daily': '日用',
  'twSouvenir.cat.gifts': '纪念品',
  'twSouvenir.delete': '删除',
  'twSouvenir.namePlaceholder': '例：零食、药品',
  'twSouvenir.recipientPlaceholder': '输入名字或选成员',
  'twSouvenir.storePlaceholder': '例：唐吉诃德、药妆店',
  'twSouvenir.storeTotals': '各店预估合计',
  'twSouvenir.taxFreeHint': '日本免税（2026/11/1 起改为出境退税）：同一家店、同一天合计满 5,000 日元（不含税）才能办理。这里用你填的预估价加总，实际以店家为准。',
};
export default twSouvenir;
