import type { AllStats, Attempt, Settings, Store, WordStats } from './types'

export const STORAGE_KEY = 'worder:v1'

export const DEFAULT_TOP_N = 500
export const DEFAULT_TOP_SHARE = 0.7
/** Preferred presentation language when the word file has one. */
const PREFERRED_LANGUAGE = 'French'

/* ------------------------------------------------------------------ */
/* Raw storage access, with an in-memory fallback                      */
/* ------------------------------------------------------------------ */

let memoryValue: string | null = null
let useMemory = false

function localStore(): Storage | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage
  } catch {
    return null
  }
}

function readRaw(): string | null {
  if (!useMemory) {
    const ls = localStore()
    if (ls) {
      try {
        return ls.getItem(STORAGE_KEY)
      } catch {
        useMemory = true
      }
    } else {
      useMemory = true
    }
  }
  return memoryValue
}

function writeRaw(value: string | null): void {
  memoryValue = value
  if (useMemory) return
  const ls = localStore()
  if (!ls) {
    useMemory = true
    return
  }
  try {
    if (value === null) ls.removeItem(STORAGE_KEY)
    else ls.setItem(STORAGE_KEY, value)
  } catch {
    useMemory = true
  }
}

/* ------------------------------------------------------------------ */
/* Defaults and validation                                             */
/* ------------------------------------------------------------------ */

export function defaultSettings(languages: string[]): Settings {
  const presentationLanguage = languages.includes(PREFERRED_LANGUAGE)
    ? PREFERRED_LANGUAGE
    : (languages[1] ?? languages[0] ?? '')
  return {
    presentationLanguage,
    topN: DEFAULT_TOP_N,
    topShare: DEFAULT_TOP_SHARE,
  }
}

export function defaultStore(languages: string[] = []): Store {
  return { version: 1, settings: defaultSettings(languages), stats: {} }
}

/**
 * Settings whose `presentationLanguage` is guaranteed to be one of `languages`.
 * A stored language the word file no longer has (or an empty one from a store
 * loaded before the CSV was known) falls back to the default for the file.
 * Returns the same object when nothing needs repairing.
 */
export function reconcileSettings(settings: Settings, languages: string[]): Settings {
  if (languages.length === 0) return settings
  if (languages.includes(settings.presentationLanguage)) return settings
  return { ...settings, presentationLanguage: defaultSettings(languages).presentationLanguage }
}

/** {@link reconcileSettings}, applied to a whole store. Not persisted. */
export function reconcileStore(store: Store, languages: string[]): Store {
  const settings = reconcileSettings(store.settings, languages)
  return settings === store.settings ? store : { ...store, settings }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseAttempts(value: unknown): Attempt[] | null {
  if (!Array.isArray(value)) return null
  const attempts: Attempt[] = []
  for (const raw of value) {
    if (!isRecord(raw)) return null
    const { t, correct } = raw
    if (typeof t !== 'number' || !Number.isFinite(t)) return null
    if (typeof correct !== 'boolean') return null
    attempts.push({ t, correct })
  }
  return attempts
}

function parseStats(value: unknown): AllStats | null {
  if (!isRecord(value)) return null
  const stats: AllStats = {}
  for (const [language, byKey] of Object.entries(value)) {
    if (!isRecord(byKey)) return null
    const wordStats: WordStats = {}
    for (const [key, rawAttempts] of Object.entries(byKey)) {
      const attempts = parseAttempts(rawAttempts)
      if (!attempts) return null
      wordStats[key] = sortAttempts(attempts)
    }
    stats[language] = wordStats
  }
  return stats
}

function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null
  const { presentationLanguage, topN, topShare } = value
  if (typeof presentationLanguage !== 'string') return null
  if (typeof topN !== 'number' || !Number.isFinite(topN)) return null
  if (typeof topShare !== 'number' || !Number.isFinite(topShare)) return null
  return {
    presentationLanguage,
    topN: Math.max(1, Math.floor(topN)),
    topShare: Math.min(1, Math.max(0, topShare)),
  }
}

/** Validate an unknown value as a `Store`. Returns `null` if it is not one. */
export function parseStore(value: unknown): Store | null {
  if (!isRecord(value)) return null
  if (value.version !== 1) return null
  const settings = parseSettings(value.settings)
  const stats = parseStats(value.stats)
  if (!settings || !stats) return null
  return { version: 1, settings, stats }
}

function sortAttempts(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => a.t - b.t)
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Read the store. Falls back to defaults when nothing is stored, when storage
 * is unavailable, or when the stored value is not a valid `Store`.
 * Pass `languages` so the default presentation language can be resolved.
 */
export function loadStore(languages: string[] = []): Store {
  const raw = readRaw()
  if (raw === null) return defaultStore(languages)
  try {
    const parsed = parseStore(JSON.parse(raw) as unknown)
    return parsed ?? defaultStore(languages)
  } catch {
    return defaultStore(languages)
  }
}

export function saveStore(store: Store): void {
  try {
    writeRaw(JSON.stringify(store))
  } catch {
    /* nothing we can do — the app keeps working with the in-memory copy */
  }
}

/** `saveStore`, returning the store so transforms can be written inline. */
function persist(store: Store): Store {
  saveStore(store)
  return store
}

/* ------------------------------------------------------------------ */
/* Pure transforms — the provider applies these to its in-memory store */
/* ------------------------------------------------------------------ */

/** `store` with one more attempt for `key` in `presLang`. */
export function withAttempt(
  store: Store,
  presLang: string,
  key: string,
  correct: boolean,
  t: number,
): Store {
  const byLanguage = store.stats[presLang] ?? {}
  const attempts = byLanguage[key] ?? []
  return {
    ...store,
    stats: {
      ...store.stats,
      [presLang]: { ...byLanguage, [key]: sortAttempts([...attempts, { t, correct }]) },
    },
  }
}

/** `store` without the most recent attempt for `key`; unchanged if it has none. */
export function withoutLastAttempt(store: Store, presLang: string, key: string): Store {
  const byLanguage = store.stats[presLang]
  const attempts = byLanguage?.[key]
  if (!byLanguage || !attempts || attempts.length === 0) return store

  const remaining = attempts.slice(0, -1)
  const nextByLanguage: WordStats = { ...byLanguage }
  if (remaining.length === 0) delete nextByLanguage[key]
  else nextByLanguage[key] = remaining

  const nextStats: AllStats = { ...store.stats }
  if (Object.keys(nextByLanguage).length === 0) delete nextStats[presLang]
  else nextStats[presLang] = nextByLanguage

  return { ...store, stats: nextStats }
}

/** `store` with every attempt dropped, keeping settings. */
export function withoutStats(store: Store): Store {
  return { ...store, stats: {} }
}

/** `store` with `partial` merged into its settings. */
export function withSettings(store: Store, partial: Partial<Settings>): Store {
  return { ...store, settings: { ...store.settings, ...partial } }
}

/* ------------------------------------------------------------------ */
/* Persisting wrappers, for callers that hold no store of their own    */
/* ------------------------------------------------------------------ */

/** Append an attempt and persist. Returns the new store. */
export function recordAttempt(
  presLang: string,
  key: string,
  correct: boolean,
  t: number = Date.now(),
): Store {
  return persist(withAttempt(loadStore(), presLang, key, correct, t))
}

/** Remove the most recent attempt for a word and persist. */
export function undoLastAttempt(presLang: string, key: string): Store {
  return persist(withoutLastAttempt(loadStore(), presLang, key))
}

/** Drop every attempt, keeping settings. */
export function resetStats(): Store {
  return persist(withoutStats(loadStore()))
}

export function updateSettings(partial: Partial<Settings>): Store {
  return persist(withSettings(loadStore(), partial))
}

export function exportJson(): string {
  return JSON.stringify(loadStore(), null, 2)
}

/**
 * The store held in an export file. Nothing is stored — the caller decides.
 * Throws an `Error` when the JSON is unparseable or not a valid `Store`.
 */
export function parseImport(json: string): Store {
  let value: unknown
  try {
    value = JSON.parse(json) as unknown
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const store = parseStore(value)
  if (!store) {
    throw new Error('That file is not a worder stats export.')
  }
  return store
}

/**
 * Replace the whole store with the contents of `json`.
 * Throws an `Error` when the JSON is unparseable or not a valid `Store`.
 */
export function importJson(json: string): Store {
  return persist(parseImport(json))
}
