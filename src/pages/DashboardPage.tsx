import { Box, Paper, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'
import AccuracyByPresentationChart from '../components/dashboard/AccuracyByPresentationChart'
import AttemptsPerDayChart from '../components/dashboard/AttemptsPerDayChart'
import HardestWordsTable from '../components/dashboard/HardestWordsTable'
import StatTiles from '../components/dashboard/StatTiles'
import type { StatTile } from '../components/dashboard/StatTiles'
import WordsPerPresentationChart from '../components/dashboard/WordsPerPresentationChart'
import { useStore } from '../hooks/useStore'
import { useWordList } from '../hooks/useWordList'
import { eligibleRows } from '../lib/scheduler'
import {
  accuracyByPresentation,
  attemptsPerDay,
  hardestWords,
  overallSummary,
} from '../lib/stats'
import type { WordRow } from '../lib/types'
import { wordKey } from '../lib/wordKey'

/** Words need this many attempts before they can be called hard. */
const MIN_ATTEMPTS = 3
const HARDEST_LIMIT = 20

export default function DashboardPage() {
  const { store } = useStore()
  const { wordList } = useWordList()
  const presLang = store.settings.presentationLanguage

  // Everything on this page is scoped to the current presentation language.
  const wordStats = useMemo(() => store.stats[presLang] ?? {}, [store.stats, presLang])

  const eligibleCount = useMemo(
    () => eligibleRows(wordList.rows, presLang).length,
    [wordList.rows, presLang],
  )
  const overall = useMemo(() => overallSummary(wordStats), [wordStats])
  const byPresentation = useMemo(() => accuracyByPresentation(wordStats), [wordStats])
  const perDay = useMemo(() => attemptsPerDay(wordStats), [wordStats])
  const hardest = useMemo(
    () => hardestWords(wordStats, MIN_ATTEMPTS, HARDEST_LIMIT),
    [wordStats],
  )

  const rowsByKey = useMemo(() => {
    const map = new Map<string, WordRow>()
    for (const row of wordList.rows) {
      const key = wordKey(row, presLang, wordList.languages)
      if (key !== null && !map.has(key)) map.set(key, row)
    }
    return map
  }, [wordList, presLang])

  const tiles: StatTile[] = [
    { label: 'Words seen', value: `${overall.words} / ${eligibleCount}` },
    { label: 'Attempts', value: `${overall.seen}` },
    {
      label: 'Overall correct',
      value: overall.pctCorrect === null ? '—' : `${Math.round(overall.pctCorrect)}%`,
    },
    { label: 'Presentation language', value: presLang },
  ]

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Dashboard
      </Typography>

      <Stack spacing={3} sx={{ mt: 1 }}>
        <StatTiles tiles={tiles} />

        <section>
          <Typography variant="h6" component="h3" gutterBottom>
            Accuracy by presentation number
          </Typography>
          <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
            <AccuracyByPresentationChart data={byPresentation} />
          </Paper>
        </section>

        <section>
          <Typography variant="h6" component="h3" gutterBottom>
            Words reaching each presentation number
          </Typography>
          <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
            <WordsPerPresentationChart data={byPresentation} />
          </Paper>
        </section>

        <section>
          <Typography variant="h6" component="h3" gutterBottom>
            Attempts per day
          </Typography>
          <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
            <AttemptsPerDayChart data={perDay} />
          </Paper>
        </section>

        <section>
          <Typography variant="h6" component="h3" gutterBottom>
            Hardest words
          </Typography>
          <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
            <HardestWordsTable
              words={hardest}
              rowsByKey={rowsByKey}
              presLang={presLang}
              languages={wordList.languages}
            />
          </Paper>
        </section>
      </Stack>
    </Box>
  )
}
