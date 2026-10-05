import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as storage from '../lib/storage'
import type { DeckId, Settings, Store } from '../lib/types'
import { useWordList } from './useWordList'

export interface StoreApi {
  store: Store
  recordAttempt: (deck: DeckId, presLang: string, key: string, correct: boolean, t?: number) => void
  undoLastAttempt: (deck: DeckId, presLang: string, key: string) => void
  resetStats: () => void
  updateSettings: (partial: Partial<Settings>) => void
  /** Throws an Error with a user-readable message when `json` is not a valid export. */
  importJson: (json: string) => void
  exportJson: () => string
}

const StoreContext = createContext<StoreApi | null>(null)

/**
 * Holds the persisted store. This provider is the single source of truth: every
 * mutation transforms the store it already has in memory and writes the result
 * through to localStorage (in-memory fallback when unavailable), so nothing ever
 * has to re-read storage without knowing the word file's languages.
 * Must be rendered inside a `WordListProvider`.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { wordList } = useWordList()
  const languages = wordList.languages

  // Loaded once, with the presentation language repaired when the word file
  // does not have the stored one (or a fresh device stored nothing at all).
  const [store, setStore] = useState<Store>(() =>
    storage.reconcileStore(storage.loadStore(languages), languages),
  )

  // On a brand-new device that resolved store exists only in memory. Write it
  // through on mount so the first visit already has a real presentation
  // language on disk, and a reload picks up exactly what is on screen.
  const initial = useRef(store)
  useEffect(() => {
    storage.saveStore(initial.current)
  }, [])

  /** Apply a pure transform to the live store and persist the result. */
  const commit = useCallback((transform: (previous: Store) => Store) => {
    setStore((previous) => {
      const next = transform(previous)
      if (next !== previous) storage.saveStore(next)
      return next
    })
  }, [])

  const recordAttempt = useCallback(
    (deck: DeckId, presLang: string, key: string, correct: boolean, t?: number) => {
      const at = t ?? Date.now()
      commit((previous) => storage.withAttempt(previous, deck, presLang, key, correct, at))
    },
    [commit],
  )

  const undoLastAttempt = useCallback(
    (deck: DeckId, presLang: string, key: string) => {
      commit((previous) => storage.withoutLastAttempt(previous, deck, presLang, key))
    },
    [commit],
  )

  const resetStats = useCallback(() => {
    commit(storage.withoutStats)
  }, [commit])

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      commit((previous) => storage.withSettings(previous, partial))
    },
    [commit],
  )

  const importJson = useCallback(
    (json: string) => {
      // `parseImport` throws on a bad file, before anything is stored.
      const imported = storage.reconcileStore(storage.parseImport(json), languages)
      commit(() => imported)
    },
    [commit, languages],
  )

  const exportJson = useCallback(() => JSON.stringify(store, null, 2), [store])

  const value = useMemo<StoreApi>(
    () => ({
      store,
      recordAttempt,
      undoLastAttempt,
      resetStats,
      updateSettings,
      importJson,
      exportJson,
    }),
    [store, recordAttempt, undoLastAttempt, resetStats, updateSettings, importJson, exportJson],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside a StoreProvider')
  return value
}
