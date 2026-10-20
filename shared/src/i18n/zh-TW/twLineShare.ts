import type { TranslationStrings } from '../types';

// 台灣在地化：LINE 分享（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLineShare: TranslationStrings = {
  'twLineShare.shareTrip': '分享行程到 LINE',
  'twLineShare.shareTripSub': '用 LINE 傳送行程公開連結',
  'twLineShare.needOwner': '只有可管理分享連結的成員能分享整個行程',
  'twLineShare.shareDay': '分享這天行程到 LINE',
  'twLineShare.error': '無法開啟 LINE 分享，請稍後再試',
};

export default twLineShare;
