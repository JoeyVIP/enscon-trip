import type { TranslationStrings } from '../types';

// 記帳換匯（新台幣對照）專用 namespace，獨立成檔避免和其他功能的 i18n 衝突
const twdBudget: TranslationStrings = {
  'twdBudget.rateNote': 'Rate 1 {base} = {rate} TWD, {date}',
  'twdBudget.offlineNote': 'Offline, rate from {date}: 1 {base} = {rate} TWD',
  'twdBudget.unavailable': 'Exchange rate is temporarily unavailable',
  'twdBudget.useTwd': 'Enter in TWD',
  'twdBudget.twdInputPlaceholder': 'Amount in NT$',
};
export default twdBudget;
