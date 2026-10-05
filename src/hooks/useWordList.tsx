import { Alert, Box, CircularProgress } from '@mui/material'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PHRASES_FILE, WORDS_FILE, fetchPhraseList, fetchWordList } from '../lib/csv'
import type { DeckId, WordList } from '../lib/types'

export interface WordListState {
  /** Always loaded: the provider renders its children only once the CSV is in. */
  wordList: WordList
  /**
   * `public/phrases.csv`, in the same shape. Empty — with `phraseError` saying
   * why — when the file is missing or unusable, so the rest of the app still
   * works without it.
   */
  phraseList: WordList
  phraseError: string | null
  loading: boolean
  error: string | null
}

const EMPTY_LIST: WordList = { languages: [], rows: [] }

const WordListContext = createContext<WordListState | null>(null)

/** A list is practisable only with a header and at least two columns. */
function usable(list: WordList): boolean {
  return list.languages.length >= 2 && list.rows.length > 0
}

function unusableMessage(file: string): string {
  return `${file} has no usable rows — it needs a header and at least two columns.`
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/** The phrase file, never rejecting: a problem becomes an empty list plus a message. */
function loadPhrases(): Promise<{ list: WordList; error: string | null }> {
  return fetchPhraseList().then(
    (list) =>
      usable(list)
        ? { list, error: null }
        : { list: EMPTY_LIST, error: unusableMessage(PHRASES_FILE) },
    (err: unknown) => ({
      list: EMPTY_LIST,
      error: errorMessage(err, `Could not load ${PHRASES_FILE}.`),
    }),
  )
}

/**
 * Fetches `public/words.csv` and `public/phrases.csv` once on app start.
 * Renders a centered spinner while loading and an Alert if the word file
 * fails to load or parse; children (and therefore `useWordList()`) only see a
 * loaded word list. The phrase file is optional: when it is unavailable the
 * phrase list is empty and `phraseError` explains why.
 */
export function WordListProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<{
    wordList: WordList
    phraseList: WordList
    phraseError: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchWordList(), loadPhrases()])
      .then(([wordList, phrases]) => {
        if (cancelled) return
        if (!usable(wordList)) {
          setError(unusableMessage(WORDS_FILE))
          return
        }
        setLists({ wordList, phraseList: phrases.list, phraseError: phrases.error })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(errorMessage(err, `Could not load ${WORDS_FILE}.`))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<WordListState | null>(
    () => (lists ? { ...lists, loading: false, error } : null),
    [lists, error],
  )

  if (error !== null && !lists) {
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

/** The list behind a deck: the word file or the phrase file. */
export function listOf(state: WordListState, deck: DeckId): WordList {
  return deck === 'phrases' ? state.phraseList : state.wordList
}
