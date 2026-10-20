import type { TranslationStrings } from '../types';

// 台灣在地化：貼上文字自動排行程（獨立 namespace，避免與其他功能的 i18n 檔衝突）
const twImport: TranslationStrings = {
  'twImport.entry': '貼上文字，自動排行程',
  'twImport.title': '貼上文字，自動排行程',
  'twImport.placeholder': '把 LINE 群組在聊的行程整段貼上…',
  'twImport.remaining': '還可輸入 {n} 字',
  'twImport.privacy': '文字會送到 AI 解析，請不要貼訂位代號與身分證字號',
  'twImport.parse': '解析',
  'twImport.parsing': '解析中…',
  'twImport.reparse': '讓 AI 再解析一次',
  'twImport.previewHint': '確認下列站點，可修改名稱與時間，不要的請取消勾選。',
  'twImport.dayHeader': '第 {n} 天',
  'twImport.unassigned': '未歸類',
  'twImport.assignPrompt': '指定日期',
  'twImport.skip': '不加入',
  'twImport.add': '加入行程（{n} 站）',
  'twImport.adding': '加入中…',
  'twImport.added': '已加入 {n} 站',
  'twImport.error': '解析或加入失敗，請稍後再試',
  'twImport.addFailed': '加入失敗，行程沒有任何改動，可以直接再試一次',
  'twImport.llmOff': '這個伺服器沒有開啟 AI 解析',
  'twImport.rateLimited': '使用次數太多，請一小時後再試',
  'twImport.empty': '還沒有可匯入的內容',
  'twImport.name': '站名',
  'twImport.time': '時間',
  'twImport.close': '關閉',
  'twImport.back': '回去改文字',
  'twImport.noResult': '這段文字裡找不到站點',
};

export default twImport;
