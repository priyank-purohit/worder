import { Stack, Typography } from '@mui/material'
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DeckId, WordStats } from '../../lib/types'
import DeckToggle from './DeckToggle'
import WordFilter from './WordFilter'
import WordGrid from './WordGrid'
import { rememberList, scrollWindowTo, takeScroll } from './listMemory'
import { SET_PARAM, accuracyByKey, deckNoun, filterWordOptions, summarizeOptions } from './options'
import type { OptionsSummary, WordOption } from './options'

export interface WordBrowserProps {
  /** Every practisable entry of the deck, in file order (= frequency rank). */
  options: WordOption[]
  /** Attempts for the current presentation language, in this deck. */
  wordStats: WordStats
  /** Which deck is being browsed; the toggle switches it. */
  deck: DeckId
  presLang: string
  /** Why the deck has nothing to show, when its file could not be loaded. */
  deckError?: string | null
}

/** `1,996 words · 120 seen · 63% correct` — the % only once something is seen. */
function countLine(deck: DeckId, { words, seen, pctCorrect }: OptionsSummary): string {
  const parts = [`${words.toLocaleString()} ${deckNoun(deck, words)}`, `${seen.toLocaleString()} seen`]
  if (pctCorrect !== null) parts.push(`${Math.round(pctCorrect)}% correct`)
  return parts.join(' · ')
}

/**
 * The browsable list: a deck toggle, a filter, a count line, and every matching
 * entry as a tile. The deck lives in the URL as `?set=` and the filter as
 * `?q=`, so returning from an entry's page restores both along with the
 * scroll position.
 */
export default function WordBrowser({
  options,
  wordStats,
  deck,
  presLang,
  deckError = null,
}: WordBrowserProps) {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''

  // Rebuilding the grid touches thousands of nodes: let the keystroke land in
  // the input first and re-filter in the background.
  const deferredQ = useDeferredValue(q)

  const shown = useMemo(() => filterWordOptions(options, deferredQ), [options, deferredQ])
  const accuracy = useMemo(() => accuracyByKey(wordStats), [wordStats])
  const summary = useMemo(() => summarizeOptions(shown, wordStats), [shown, wordStats])

  const setQ = useCallback(
    (next: string) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous)
          if (next === '') updated.delete('q')
          else updated.set('q', next)
          return updated
        },
        // Typing must not fill the history stack; the list is one entry.
        { replace: true },
      )
    },
    [setParams],
  )

  // Switching decks keeps the filter: `eau` is as useful a search in phrases.
  const setDeck = useCallback(
    (next: DeckId) => {
      setParams((previous) => {
        const updated = new URLSearchParams(previous)
        if (next === 'phrases') updated.set(SET_PARAM, 'phrases')
        else updated.delete(SET_PARAM)
        return updated
      })
    },
    [setParams],
  )

  const handleNavigate = useCallback(() => {
    rememberList(q, window.scrollY)
  }, [q])

  // Coming back from a word: pick the list up where it was left.
  useEffect(() => {
    const y = takeScroll()
    if (y > 0) scrollWindowTo(y)
  }, [])

  const noun = deckNoun(deck, 1)

  return (
    <Stack spacing={1.5}>
      {/* Every route names itself with an `h2`, and the grid below has no
          heading of its own to give the page one. */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="h5" component="h2">
          {deck === 'phrases' ? 'Phrases' : 'Words'}
        </Typography>
        <DeckToggle value={deck} onChange={setDeck} />
      </Stack>

      <WordFilter value={q} onChange={setQ} />

      <Typography variant="body2" color="text.secondary">
        {countLine(deck, summary)}
      </Typography>

      {shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {deckError !== null && options.length === 0
            ? deckError
            : `No ${presLang} ${noun} matches “${deferredQ}”.`}
        </Typography>
      ) : (
        <WordGrid
          options={shown}
          deck={deck}
          presLang={presLang}
          accuracy={accuracy}
          q={q}
          onNavigate={handleNavigate}
        />
      )}
    </Stack>
  )
}
