import type { TranslationStrings } from '../types';

// 記帳換匯（新台幣對照）專用 namespace，獨立成檔避免和其他功能的 i18n 衝突
const twdBudget: TranslationStrings = {
  'twdBudget.rateNote': '≈ NT$ 是約略換算，匯率 1 {base} = {rate} TWD，{date}',
  'twdBudget.offlineNote': '≈ NT$ 是約略換算；離線中，用 {date} 的匯率：1 {base} = {rate} TWD',
  'twdBudget.unavailable': '匯率暫時抓不到',
  'twdBudget.useTwd': '用台幣輸入',
  'twdBudget.twdInputPlaceholder': '輸入新台幣金額',
};
export default twdBudget;
