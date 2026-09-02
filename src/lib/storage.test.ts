import { beforeEach, describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  defaultSettings,
  exportJson,
  importJson,
  loadStore,
  recordAttempt,
  resetStats,
  saveStore,
  undoLastAttempt,
  updateSettings,
} from './storage'

const LANGS = ['English', 'French', 'Gujarati', 'Hindi']

beforeEach(() => {
  localStorage.clear()
})

describe('defaultSettings', () => {
  it('prefers French, else the second language', () => {
    expect(defaultSettings(LANGS)).toEqual({
      presentationLanguage: 'French',
      topN: 500,
      topShare: 0.7,
    })
    expect(defaultSettings(['English', 'Spanish']).presentationLanguage).toBe('Spanish')
    expect(defaultSettings(['English']).presentationLanguage).toBe('English')
  })
})

describe('loadStore', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadStore(LANGS)).toEqual({
      version: 1,
      settings: defaultSettings(LANGS),
      stats: {},
    })
  })

  it('ignores corrupt or foreign data', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect(loadStore(LANGS).stats).toEqual({})
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 9 }))
    expect(loadStore(LANGS).stats).toEqual({})
  })
})

describe('attempts', () => {
  it('records attempts under the language and key, chronologically', () => {
    saveStore(loadStore(LANGS))
    recordAttempt('French', 'à::to', false, 200)
    const store = recordAttempt('French', 'à::to', true, 100)
    expect(store.stats.French['à::to']).toEqual([
      { t: 100, correct: true },
      { t: 200, correct: false },
    ])
    expect(loadStore(LANGS).stats.French['à::to']).toHaveLength(2)
  })

  it('undo removes the most recent attempt and prunes empty entries', () => {
    recordAttempt('French', 'à::to', true, 100)
    recordAttempt('French', 'à::to', false, 200)
    expect(undoLastAttempt('French', 'à::to').stats.French['à::to']).toEqual([
      { t: 100, correct: true },
    ])
    expect(undoLastAttempt('French', 'à::to').stats.French).toBeUndefined()
    expect(undoLastAttempt('French', 'à::to').stats).toEqual({})
  })

  it('resetStats keeps settings', () => {
    updateSettings({ topN: 42 })
    recordAttempt('French', 'à::to', true, 100)
    const store = resetStats()
    expect(store.stats).toEqual({})
    expect(store.settings.topN).toBe(42)
  })
})

describe('updateSettings', () => {
  it('merges partial settings and persists them', () => {
    updateSettings({ presentationLanguage: 'Hindi' })
    const store = updateSettings({ topShare: 0.25 })
    expect(store.settings.presentationLanguage).toBe('Hindi')
    expect(loadStore(LANGS).settings.topShare).toBe(0.25)
  })
})

describe('export / import', () => {
  it('round-trips through JSON', () => {
    updateSettings(defaultSettings(LANGS))
    recordAttempt('French', 'à::to', true, 100)
    const json = exportJson()
    resetStats()
    expect(importJson(json).stats.French['à::to']).toEqual([{ t: 100, correct: true }])
  })

  it('rejects invalid payloads', () => {
    expect(() => importJson('{')).toThrow(/valid JSON/)
    expect(() => importJson('{"version":1}')).toThrow(/worder stats export/)
    expect(() =>
      importJson(JSON.stringify({ version: 1, settings: defaultSettings(LANGS), stats: { French: 1 } })),
    ).toThrow()
  })
})
