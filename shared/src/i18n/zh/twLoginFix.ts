import type { TranslationStrings } from '../types';

// 台灣在地化：登入失敗訊息與重試（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLoginFix: TranslationStrings = {
  'twLoginFix.registrationDisabled': '这个 LINE 账号还没加入。请用朋友分享给你的邀请链接再登录一次。',
  'twLoginFix.noEmail': 'LINE 没有提供 Email，无法创建账号。请确认 LINE 账号已设置 Email，再重新登录一次。',
  'twLoginFix.tokenFailed': '与 LINE 验证时失败了。请再点一次“重新用 LINE 登录”。',
  'twLoginFix.invalidState': '登录超时或被中断了（例如中途换了浏览器）。请在同一个浏览器再登录一次。',
  'twLoginFix.serverError': '系统这边出了点状况。请稍等一下再重新登录。',
  'twLoginFix.exchangeFailed': '登录的最后一步没完成（链接过期或换了浏览器）。请在同一个浏览器重新登录。',
  'twLoginFix.unknown': '登录没有成功，请再试一次。',
  'twLoginFix.retry': '重新用 LINE 登录',
};
export default twLoginFix;
