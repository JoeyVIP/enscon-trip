import type { TranslationStrings } from '../types';

// 台灣在地化：LINE 分享（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLineShare: TranslationStrings = {
  'twLineShare.shareTrip': '分享行程到 LINE',
  'twLineShare.shareTripSub': '用 LINE 发送行程公开链接',
  'twLineShare.needOwner': '只有可管理分享链接的成员能分享整个行程',
  'twLineShare.shareDay': '分享这天行程到 LINE',
  'twLineShare.error': '无法打开 LINE 分享，请稍后再试',
};

export default twLineShare;
