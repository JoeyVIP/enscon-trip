import type { TranslationStrings } from '../types';

// 台灣在地化：LINE 分享（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLineShare: TranslationStrings = {
  'twLineShare.shareTrip': 'LINEで旅程を共有',
  'twLineShare.shareTripSub': '公開共有リンクをLINEで送信',
  'twLineShare.needOwner': '共有リンクを管理できるメンバーのみ旅程全体を共有できます',
  'twLineShare.shareDay': 'この日の予定をLINEで共有',
  'twLineShare.error': 'LINEの共有を開けませんでした',
};

export default twLineShare;
