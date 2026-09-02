import { beforeEach, describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  defaultSettings,
  defaultStore,
  exportJson,
  importJson,
  loadStore,
  parseImport,
  parseStore,
  reconcileSettings,
  reconcileStore,
  recordAttempt,
  resetStats,
  saveStore,
  undoLastAttempt,
  updateSettings,
  withAttempt,
  withoutLastAttempt,
} from './storage'
import type { Store } from './types'

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

describe('reconcile', () => {
  it('keeps a presentation language the word file still has', () => {
    const settings = defaultSettings(LANGS)
    expect(reconcileSettings(settings, LANGS)).toBe(settings)
  })

  it('falls back to the default when the file no longer has the language', () => {
    const settings = { presentationLanguage: 'Klingon', topN: 12, topShare: 0.4 }
    expect(reconcileSettings(settings, LANGS)).toEqual({ ...settings, presentationLanguage: 'French' })
    // An empty language — what a store loaded before the CSV looks like.
    expect(reconcileSettings({ ...settings, presentationLanguage: '' }, LANGS).presentationLanguage).toBe(
      'French',
    )
  })

  it('leaves the store alone when no word file is known yet', () => {
    const store = defaultStore([])
    expect(store.settings.presentationLanguage).toBe('')
    expect(reconcileStore(store, [])).toBe(store)
  })

  it('repairs only the language, keeping stats and the other settings', () => {
    const store: Store = {
      version: 1,
      settings: { presentationLanguage: 'Klingon', topN: 12, topShare: 0.4 },
      stats: { Klingon: { 'a::b': [{ t: 1, correct: true }] } },
    }
    const repaired = reconcileStore(store, LANGS)
    expect(repaired.settings).toEqual({ presentationLanguage: 'French', topN: 12, topShare: 0.4 })
    expect(repaired.stats).toBe(store.stats)
  })
})

describe('pure transforms', () => {
  it('append and undo without touching storage', () => {
    const base = defaultStore(LANGS)
    const one = withAttempt(base, 'French', 'à::to', true, 100)
    const two = withAttempt(one, 'French', 'à::to', false, 200)

    expect(two.stats.French['à::to']).toEqual([
      { t: 100, correct: true },
      { t: 200, correct: false },
    ])
    // The inputs are untouched, and nothing was written.
    expect(base.stats).toEqual({})
    expect(one.stats.French['à::to']).toHaveLength(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    expect(withoutLastAttempt(two, 'French', 'à::to').stats.French['à::to']).toEqual([
      { t: 100, correct: true },
    ])
    expect(withoutLastAttempt(base, 'French', 'à::to')).toBe(base)
  })
})

describe('parseStore / parseImport', () => {
  it('accepts a valid store and rejects anything else', () => {
    const store = withAttempt(defaultStore(LANGS), 'French', 'à::to', true, 100)
    expect(parseStore(JSON.parse(JSON.stringify(store)) as unknown)).toEqual(store)
    expect(parseStore({ version: 1 })).toBeNull()
    // parseImport validates but stores nothing.
    expect(parseImport(JSON.stringify(store)).stats).toEqual(store.stats)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
