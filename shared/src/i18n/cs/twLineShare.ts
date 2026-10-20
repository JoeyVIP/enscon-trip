import type { TranslationStrings } from '../types';

// 台灣在地化：LINE 分享（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLineShare: TranslationStrings = {
  'twLineShare.shareTrip': 'Share trip to LINE',
  'twLineShare.shareTripSub': 'Send the public share link via LINE',
  'twLineShare.needOwner': 'Ask the trip owner to create a share link first',
  'twLineShare.shareDay': 'Share today\'s plan to LINE',
  'twLineShare.error': 'Could not open LINE sharing',
};

export default twLineShare;
