import { describe, expect, it } from 'vitest'
import en from '@trek/shared/i18n/en'
import zh from '@trek/shared/i18n/zh'
import zhTW from '@trek/shared/i18n/zh-TW'
import { DOCK_PRIORITY } from '../mobile/screens/trip/dockTabs'
import { TRIP_TAB_IDS, TRIP_TAB_LABEL_KEYS } from './tripTabs'

// FE-TRIPTABS-001 to FE-TRIPTABS-003 (Taiwan fork)

describe('trip tab labels', () => {
  it('FE-TRIPTABS-001: the collab tab is named through twNav, so zh-TW no longer reads "Collab"', () => {
    expect(TRIP_TAB_LABEL_KEYS.collab).toBe('twNav.collab')
    expect(zhTW['twNav.collab']).toBe('筆記與聊天')
    expect(zh['twNav.collab']).toBe('笔记与聊天')
    expect(en['twNav.collab']).toBe('Collab')
  })

  it('FE-TRIPTABS-002: every tab label key resolves in en and zh-TW', () => {
    for (const id of TRIP_TAB_IDS) {
      const key = TRIP_TAB_LABEL_KEYS[id]
      expect(typeof en[key], `en ${key}`).toBe('string')
      expect(typeof zhTW[key], `zh-TW ${key}`).toBe('string')
    }
  })

  it('FE-TRIPTABS-003: every dock caption resolves in zh-TW to Chinese', () => {
    for (const tab of DOCK_PRIORITY) {
      expect(zhTW[tab.labelKey], tab.labelKey).toMatch(/\p{Script=Han}/u)
      expect(typeof en[tab.labelKey], tab.labelKey).toBe('string')
    }
    expect(zhTW['twNav.dock.budget']).toBe('費用')
  })
})
