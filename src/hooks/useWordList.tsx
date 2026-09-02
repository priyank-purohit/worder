import { Alert, Box, CircularProgress } from '@mui/material'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchWordList } from '../lib/csv'
import type { WordList } from '../lib/types'

export interface WordListState {
  /** Always loaded: the provider renders its children only once the CSV is in. */
  wordList: WordList
  loading: boolean
  error: string | null
}

const WordListContext = createContext<WordListState | null>(null)

/**
 * Fetches `public/words.csv` once on app start. Renders a centered spinner
 * while loading and an Alert if the fetch or parse fails; children (and
 * therefore `useWordList()`) only see a loaded word list.
 */
export function WordListProvider({ children }: { children: ReactNode }) {
  const [wordList, setWordList] = useState<WordList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchWordList()
      .then((list) => {
        if (cancelled) return
        if (list.languages.length < 2 || list.rows.length === 0) {
          setError('words.csv has no usable rows — it needs a header and at least two columns.')
          return
        }
        setWordList(list)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load words.csv.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<WordListState | null>(
    () => (wordList ? { wordList, loading: false, error } : null),
    [wordList, error],
  )

  if (error !== null && !wordList) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  if (!value) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return <WordListContext.Provider value={value}>{children}</WordListContext.Provider>
}

/** The loaded word list. Must be called inside a `WordListProvider`. */
export function useWordList(): WordListState {
  const value = useContext(WordListContext)
  if (!value) throw new Error('useWordList must be used inside a WordListProvider')
  return value
}
