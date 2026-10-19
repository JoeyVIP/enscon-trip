import { useTranslation } from '../i18n'

/**
 * The product name shown to people: "ENSCON 旅程" in the Chinese locales,
 * "ENSCON Trip" in every other language. This is a rebrand of the upstream
 * TREK app (see NOTICE.md / TRADEMARKS.md), so the upstream name must not
 * appear as the product's own name.
 */
export const APP_NAME_ZH = 'ENSCON 旅程'
export const APP_NAME_EN = 'ENSCON Trip'

export function appNameFor(language?: string): string {
  return language && /^zh/i.test(language) ? APP_NAME_ZH : APP_NAME_EN
}

export function useAppName(): string {
  const { language } = useTranslation()
  return appNameFor(language)
}
