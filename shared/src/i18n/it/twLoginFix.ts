import type { TranslationStrings } from '../types';

// 台灣在地化：登入失敗訊息與重試（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twLoginFix: TranslationStrings = {
  'twLoginFix.registrationDisabled': 'This LINE account has not joined yet. Please sign in again using the invite link a friend shared with you.',
  'twLoginFix.noEmail': 'LINE did not provide an email, so an account could not be created. Check that your LINE account has an email, then try again.',
  'twLoginFix.tokenFailed': 'Verification with LINE failed. Please try signing in with LINE again.',
  'twLoginFix.invalidState': 'The sign-in timed out or was interrupted (for example by switching browsers). Please sign in again in the same browser.',
  'twLoginFix.serverError': 'Something went wrong on our side. Please wait a moment and try again.',
  'twLoginFix.exchangeFailed': 'The last step of signing in did not finish (the link expired or the browser changed). Please sign in again in the same browser.',
  'twLoginFix.unknown': 'Sign-in did not succeed. Please try again.',
  'twLoginFix.retry': 'Sign in with LINE again',
};
export default twLoginFix;
