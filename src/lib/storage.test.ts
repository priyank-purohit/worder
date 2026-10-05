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
  statsOf,
  undoLastAttempt,
  updateSettings,
  withAttempt,
  withoutLastAttempt,
  withoutStats,
} from './storage'
import type { Settings, Store } from './types'

const LANGS = ['English', 'French', 'Gujarati', 'Hindi']

/**
 * A store exactly as it was written before `themeMode` existed. Typed loosely
 * on purpose: this is what real localStorage and older export files hold.
 */
function legacyJson(settings: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    settings: { presentationLanguage: 'French', topN: 12, topShare: 0.4, ...settings },
    stats: { French: { 'à::to': [{ t: 1, correct: true }] } },
  })
}

/** Settings from before `themeMode`, for the reconcile path. */
function legacySettings(settings: Record<string, unknown> = {}): Settings {
  return { presentationLanguage: 'French', topN: 12, topShare: 0.4, ...settings } as Settings
}

beforeEach(() => {
  localStorage.clear()
})

describe('defaultSettings', () => {
  it('prefers French, else the second language', () => {
    expect(defaultSettings(LANGS)).toEqual({
      presentationLanguage: 'French',
      topN: 500,
      topShare: 0.7,
      themeMode: 'system',
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
      phraseStats: {},
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
    recordAttempt('words', 'French', 'à::to', false, 200)
    const store = recordAttempt('words', 'French', 'à::to', true, 100)
    expect(store.stats.French['à::to']).toEqual([
      { t: 100, correct: true },
      { t: 200, correct: false },
    ])
    expect(loadStore(LANGS).stats.French['à::to']).toHaveLength(2)
  })

  it('undo removes the most recent attempt and prunes empty entries', () => {
    recordAttempt('words', 'French', 'à::to', true, 100)
    recordAttempt('words', 'French', 'à::to', false, 200)
    expect(undoLastAttempt('words', 'French', 'à::to').stats.French['à::to']).toEqual([
      { t: 100, correct: true },
    ])
    expect(undoLastAttempt('words', 'French', 'à::to').stats.French).toBeUndefined()
    expect(undoLastAttempt('words', 'French', 'à::to').stats).toEqual({})
  })

  it('resetStats keeps settings', () => {
    updateSettings({ topN: 42 })
    recordAttempt('words', 'French', 'à::to', true, 100)
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
    recordAttempt('words', 'French', 'à::to', true, 100)
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
    const settings: Settings = {
      presentationLanguage: 'Klingon',
      topN: 12,
      topShare: 0.4,
      themeMode: 'dark',
    }
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
      settings: {
        presentationLanguage: 'Klingon',
        topN: 12,
        topShare: 0.4,
        themeMode: 'light',
      },
      stats: { Klingon: { 'a::b': [{ t: 1, correct: true }] } },
      phraseStats: {},
    }
    const repaired = reconcileStore(store, LANGS)
    expect(repaired.settings).toEqual({
      presentationLanguage: 'French',
      topN: 12,
      topShare: 0.4,
      themeMode: 'light',
    })
    expect(repaired.stats).toBe(store.stats)
  })
})

describe('pure transforms', () => {
  it('append and undo without touching storage', () => {
    const base = defaultStore(LANGS)
    const one = withAttempt(base, 'words', 'French', 'à::to', true, 100)
    const two = withAttempt(one, 'words', 'French', 'à::to', false, 200)

    expect(two.stats.French['à::to']).toEqual([
      { t: 100, correct: true },
      { t: 200, correct: false },
    ])
    // The inputs are untouched, and nothing was written.
    expect(base.stats).toEqual({})
    expect(one.stats.French['à::to']).toHaveLength(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    expect(withoutLastAttempt(two, 'words', 'French', 'à::to').stats.French['à::to']).toEqual([
      { t: 100, correct: true },
    ])
    expect(withoutLastAttempt(base, 'words', 'French', 'à::to')).toBe(base)
  })
})

describe('parseStore / parseImport', () => {
  it('accepts a valid store and rejects anything else', () => {
    const store = withAttempt(defaultStore(LANGS), 'words', 'French', 'à::to', true, 100)
    expect(parseStore(JSON.parse(JSON.stringify(store)) as unknown)).toEqual(store)
    expect(parseStore({ version: 1 })).toBeNull()
    // parseImport validates but stores nothing.
    expect(parseImport(JSON.stringify(store)).stats).toEqual(store.stats)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('themeMode backward compatibility', () => {
  it('reads a store saved before themeMode existed as "system"', () => {
    // localStorage written by an older build...
    localStorage.setItem(STORAGE_KEY, legacyJson())
    const loaded = loadStore(LANGS)
    expect(loaded.settings.themeMode).toBe('system')
    // ...with everything else it held intact.
    expect(loaded.settings.topN).toBe(12)
    expect(loaded.stats.French['à::to']).toEqual([{ t: 1, correct: true }])

    // ...and an export file from the same build.
    expect(parseImport(legacyJson()).settings.themeMode).toBe('system')
    expect(parseStore(JSON.parse(legacyJson()) as unknown)?.settings.themeMode).toBe('system')
    // reconcileSettings repairs the same gap, in place, without a word file.
    expect(reconcileSettings(legacySettings(), LANGS).themeMode).toBe('system')
    expect(reconcileSettings(legacySettings(), []).themeMode).toBe('system')
  })

  it('rejects a value that is not one of the three modes', () => {
    for (const bad of ['sepia', '', 1, null, true, {}]) {
      expect(parseImport(legacyJson({ themeMode: bad })).settings.themeMode).toBe('system')
      expect(reconcileSettings(legacySettings({ themeMode: bad }), LANGS).themeMode).toBe('system')
    }
  })

  it('keeps a valid stored mode, and persists a new one', () => {
    expect(parseImport(legacyJson({ themeMode: 'dark' })).settings.themeMode).toBe('dark')
    const settings = legacySettings({ themeMode: 'light' })
    // Nothing to repair: the same object comes back.
    expect(reconcileSettings(settings, LANGS)).toBe(settings)

    expect(updateSettings({ themeMode: 'dark' }).settings.themeMode).toBe('dark')
    expect(loadStore(LANGS).settings.themeMode).toBe('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"themeMode":"dark"')
  })
})

describe('phrase deck', () => {
  it('keeps phrase attempts apart from word attempts', () => {
    const one = withAttempt(defaultStore(LANGS), 'phrases', 'French', 'Bonjour::Hello', true, 100)
    expect(one.phraseStats.French['Bonjour::Hello']).toEqual([{ t: 100, correct: true }])
    expect(one.stats).toEqual({})
    expect(statsOf(one, 'phrases')).toBe(one.phraseStats)
    expect(statsOf(one, 'words')).toBe(one.stats)

    // Undoing a phrase leaves the word bucket alone, and the other way round.
    const both = withAttempt(one, 'words', 'French', 'à::to', false, 200)
    const undone = withoutLastAttempt(both, 'phrases', 'French', 'Bonjour::Hello')
    expect(undone.phraseStats).toEqual({})
    expect(undone.stats.French['à::to']).toHaveLength(1)
    expect(withoutLastAttempt(both, 'phrases', 'French', 'à::to')).toBe(both)
  })

  it('persists phrase attempts through the wrappers and clears both decks on reset', () => {
    recordAttempt('phrases', 'French', 'Merci::Thanks', false, 5)
    recordAttempt('words', 'French', 'à::to', true, 6)
    expect(loadStore(LANGS).phraseStats.French['Merci::Thanks']).toHaveLength(1)
    expect(undoLastAttempt('phrases', 'French', 'Merci::Thanks').phraseStats).toEqual({})
    expect(loadStore(LANGS).stats.French['à::to']).toHaveLength(1)

    recordAttempt('phrases', 'French', 'Merci::Thanks', true, 7)
    const cleared = resetStats()
    expect(cleared.stats).toEqual({})
    expect(cleared.phraseStats).toEqual({})
    expect(withoutStats(loadStore(LANGS)).phraseStats).toEqual({})
  })

  it('reads a store or export written before the phrase deck existed', () => {
    // No `phraseStats` key at all: nothing has been lost, so nothing is rejected.
    localStorage.setItem(STORAGE_KEY, legacyJson())
    expect(loadStore(LANGS).phraseStats).toEqual({})
    expect(parseImport(legacyJson()).phraseStats).toEqual({})

    // Present and well-formed: kept. Present and malformed: the file is rejected.
    const withPhrases = { ...JSON.parse(legacyJson()), phraseStats: { French: { 'a::b': [{ t: 1, correct: false }] } } }
    expect(parseStore(withPhrases)?.phraseStats.French['a::b']).toEqual([{ t: 1, correct: false }])
    expect(parseStore({ ...withPhrases, phraseStats: { French: 1 } })).toBeNull()
  })

  it('round-trips phrase stats through export and import', () => {
    recordAttempt('phrases', 'French', 'Merci::Thanks', true, 7)
    const json = exportJson()
    localStorage.clear()
    expect(importJson(json).phraseStats.French['Merci::Thanks']).toEqual([{ t: 7, correct: true }])
  })
})
