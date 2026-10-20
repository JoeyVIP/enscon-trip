import type { TranslationStrings } from '../types';

// 台灣在地化：登入失敗訊息與重試（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLoginFix: TranslationStrings = {
  'twLoginFix.registrationDisabled': '這個 LINE 帳號還沒加入。請用朋友分享給你的邀請連結再登入一次。',
  'twLoginFix.noEmail': 'LINE 沒有提供 Email，無法建立帳號。請確認 LINE 帳號已設定 Email，再重新登入一次。',
  'twLoginFix.tokenFailed': '跟 LINE 驗證時失敗了。請再按一次「重新用 LINE 登入」。',
  'twLoginFix.invalidState': '登入逾時或被中斷了（例如中途換了瀏覽器）。請在同一個瀏覽器再登入一次。',
  'twLoginFix.serverError': '系統這邊出了點狀況。請稍等一下再重新登入。',
  'twLoginFix.exchangeFailed': '登入的最後一步沒完成（連結過期或換了瀏覽器）。請在同一個瀏覽器重新登入。',
  'twLoginFix.unknown': '登入沒有成功，請再試一次。',
  'twLoginFix.retry': '重新用 LINE 登入',
};
export default twLoginFix;
