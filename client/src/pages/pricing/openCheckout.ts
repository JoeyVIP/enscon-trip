/** 跳到 Recur 的託管付款頁。獨立成一個函式，測試才換得掉（jsdom 不支援真的換頁）。 */
export function openCheckout(url: string): void {
  window.location.assign(url)
}
