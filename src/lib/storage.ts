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

/** Append an attempt and persist. Returns the new store. */
export function recordAttempt(
  presLang: string,
  key: string,
  correct: boolean,
  t: number = Date.now(),
): Store {
  const store = loadStore()
  const byLanguage = store.stats[presLang] ?? {}
  const attempts = byLanguage[key] ?? []
  const next: Store = {
    ...store,
    stats: {
      ...store.stats,
      [presLang]: { ...byLanguage, [key]: sortAttempts([...attempts, { t, correct }]) },
    },
  }
  saveStore(next)
  return next
}

/** Remove the most recent attempt for a word and persist. */
export function undoLastAttempt(presLang: string, key: string): Store {
  const store = loadStore()
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

  const next: Store = { ...store, stats: nextStats }
  saveStore(next)
  return next
}

/** Drop every attempt, keeping settings. */
export function resetStats(): Store {
  const next: Store = { ...loadStore(), stats: {} }
  saveStore(next)
  return next
}

export function updateSettings(partial: Partial<Settings>): Store {
  const store = loadStore()
  const next: Store = { ...store, settings: { ...store.settings, ...partial } }
  saveStore(next)
  return next
}

export function exportJson(): string {
  return JSON.stringify(loadStore(), null, 2)
}

/**
 * Replace the whole store with the contents of `json`.
 * Throws an `Error` when the JSON is unparseable or not a valid `Store`.
 */
export function importJson(json: string): Store {
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
  saveStore(store)
  return store
}
