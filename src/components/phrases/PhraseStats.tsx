import { Button, Paper, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { accuracyByPresentation, attemptsPerDay, hardestWords, overallSummary } from '../../lib/stats'
import type { WordList, WordRow, WordStats } from '../../lib/types'
import { wordKey } from '../../lib/wordKey'
import AccuracyByPresentationChart from '../dashboard/AccuracyByPresentationChart'
import AttemptsPerDayChart from '../dashboard/AttemptsPerDayChart'
import HardestWordsTable from '../dashboard/HardestWordsTable'
import StatTiles from '../dashboard/StatTiles'
import type { StatTile } from '../dashboard/StatTiles'
import { browsePath } from '../words/options'

/** Phrases need this many attempts before they can be called hard. */
const MIN_ATTEMPTS = 3
const HARDEST_LIMIT = 20

export interface PhraseStatsProps {
  phraseList: WordList
  /** Attempts on phrases in the current presentation language. */
  phraseStats: WordStats
  presLang: string
  /** How many phrases have a text in `presLang`. */
  eligibleCount: number
}

/**
 * The phrase deck's own dashboard: tiles, attempts per day, accuracy by
 * presentation number and the hardest phrases. Lives on the Phrases tab rather
 * than on the Dashboard, which stays about words.
 */
export default function PhraseStats({
  phraseList,
  phraseStats,
  presLang,
  eligibleCount,
}: PhraseStatsProps) {
  const overall = useMemo(() => overallSummary(phraseStats), [phraseStats])
  const byPresentation = useMemo(() => accuracyByPresentation(phraseStats), [phraseStats])
  const perDay = useMemo(() => attemptsPerDay(phraseStats), [phraseStats])
  const hardest = useMemo(
    () => hardestWords(phraseStats, MIN_ATTEMPTS, HARDEST_LIMIT),
    [phraseStats],
  )

  const rowsByKey = useMemo(() => {
    const map = new Map<string, WordRow>()
    for (const row of phraseList.rows) {
      const key = wordKey(row, presLang, phraseList.languages)
      if (key !== null && !map.has(key)) map.set(key, row)
    }
    return map
  }, [phraseList, presLang])

  const tiles: StatTile[] = [
    {
      id: 'phrases-seen',
      label: 'Phrases seen',
      value: `${overall.words.toLocaleString()} / ${eligibleCount.toLocaleString()}`,
    },
    { id: 'phrase-attempts', label: 'Attempts', value: overall.seen.toLocaleString() },
    {
      id: 'phrase-overall-correct',
      label: 'Overall correct',
      value: overall.pctCorrect === null ? '—' : `${Math.round(overall.pctCorrect)}%`,
    },
    { id: 'phrase-presentation-language', label: 'Presentation language', value: presLang },
  ]

  return (
    <Stack spacing={3} data-testid="phrase-stats">
      <StatTiles tiles={tiles} />

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
          Accuracy by presentation number
        </Typography>
        <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
          <AccuracyByPresentationChart data={byPresentation} subject="phrases" />
        </Paper>
      </section>

      <section>
        <Typography variant="h6" component="h3" gutterBottom>
          Hardest phrases
        </Typography>
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <HardestWordsTable
            words={hardest}
            rowsByKey={rowsByKey}
            presLang={presLang}
            languages={phraseList.languages}
            deck="phrases"
          />
        </Paper>
      </section>

      <Button
        component={RouterLink}
        to={browsePath('phrases')}
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
      >
        Browse all phrases
      </Button>
    </Stack>
  )
}
