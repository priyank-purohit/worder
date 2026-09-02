import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as storage from '../lib/storage'
import type { Settings, Store } from '../lib/types'
import { useWordList } from './useWordList'

export interface StoreApi {
  store: Store
  recordAttempt: (presLang: string, key: string, correct: boolean, t?: number) => void
  undoLastAttempt: (presLang: string, key: string) => void
  resetStats: () => void
  updateSettings: (partial: Partial<Settings>) => void
  /** Throws an Error with a user-readable message when `json` is not a valid export. */
  importJson: (json: string) => void
  exportJson: () => string
}

const StoreContext = createContext<StoreApi | null>(null)

/**
 * Holds the persisted store. Every mutation writes through to localStorage
 * (in-memory fallback when unavailable) and re-renders consumers.
 * Must be rendered inside a `WordListProvider`.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { wordList } = useWordList()
  const languages = wordList.languages
  // Load once, repairing a presentation language that the word file no longer has.
  const [store, setStore] = useState<Store>(() => {
    const loaded = storage.loadStore(languages)
    if (languages.length === 0 || languages.includes(loaded.settings.presentationLanguage)) {
      return loaded
    }
    return storage.updateSettings({
      presentationLanguage: storage.defaultSettings(languages).presentationLanguage,
    })
  })

  const recordAttempt = useCallback(
    (presLang: string, key: string, correct: boolean, t?: number) => {
      setStore(storage.recordAttempt(presLang, key, correct, t ?? Date.now()))
    },
    [],
  )

  const undoLastAttempt = useCallback((presLang: string, key: string) => {
    setStore(storage.undoLastAttempt(presLang, key))
  }, [])

  const resetStats = useCallback(() => {
    setStore(storage.resetStats())
  }, [])

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setStore(storage.updateSettings(partial))
  }, [])

  const importJson = useCallback((json: string) => {
    setStore(storage.importJson(json))
  }, [])

  const exportJson = useCallback(() => storage.exportJson(), [])

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
