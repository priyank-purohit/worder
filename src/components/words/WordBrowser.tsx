import { Stack, Typography } from '@mui/material'
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WordStats } from '../../lib/types'
import WordFilter from './WordFilter'
import WordGrid from './WordGrid'
import { rememberList, scrollWindowTo, takeScroll } from './listMemory'
import { accuracyByKey, filterWordOptions, summarizeOptions } from './options'
import type { OptionsSummary, WordOption } from './options'

export interface WordBrowserProps {
  /** Every practisable word, in file order (= frequency rank). */
  options: WordOption[]
  /** Attempts for the current presentation language. */
  wordStats: WordStats
  presLang: string
}

/** `1,996 words · 120 seen · 63% correct` — the % only once something is seen. */
function countLine({ words, seen, pctCorrect }: OptionsSummary): string {
  const parts = [
    `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`,
    `${seen.toLocaleString()} seen`,
  ]
  if (pctCorrect !== null) parts.push(`${Math.round(pctCorrect)}% correct`)
  return parts.join(' · ')
}

/**
 * The browsable word list: a filter, a count line, and every matching word as a
 * tile. The filter lives in the URL as `?q=`, so returning from a word's page
 * restores it along with the scroll position.
 */
export default function WordBrowser({ options, wordStats, presLang }: WordBrowserProps) {
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

  const handleNavigate = useCallback(() => {
    rememberList(q, window.scrollY)
  }, [q])

  // Coming back from a word: pick the list up where it was left.
  useEffect(() => {
    const y = takeScroll()
    if (y > 0) scrollWindowTo(y)
  }, [])

  return (
    <Stack spacing={1.5}>
      {/* Every route names itself with an `h2`, and the grid below has no
          heading of its own to give the page one. */}
      <Typography variant="h5" component="h2">
        Words
      </Typography>

      <WordFilter value={q} onChange={setQ} />

      <Typography variant="body2" color="text.secondary">
        {countLine(summary)}
      </Typography>

      {shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No {presLang} word matches “{deferredQ}”.
        </Typography>
      ) : (
        <WordGrid
          options={shown}
          presLang={presLang}
          accuracy={accuracy}
          q={q}
          onNavigate={handleNavigate}
        />
      )}
    </Stack>
  )
}
