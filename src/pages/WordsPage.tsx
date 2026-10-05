import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Alert, Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material'
import { useEffect, useMemo } from 'react'
import { Link as RouterLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import AttemptList from '../components/words/AttemptList'
import WordBrowser from '../components/words/WordBrowser'
import WordDetail from '../components/words/WordDetail'
import WordHistoryChart from '../components/words/WordHistoryChart'
import { listPath, scrollWindowTo } from '../components/words/listMemory'
import {
  buildWordOptions,
  deckFromParams,
  deckNoun,
  decodeKeyParam,
  findWordOption,
} from '../components/words/options'
import { useStore } from '../hooks/useStore'
import { listOf, useWordList } from '../hooks/useWordList'
import { statsOf } from '../lib/storage'

/**
 * `/words` browses the whole word list — or, with `?set=phrases`, the phrase
 * list; `/words/:key` is one entry's history, in whichever deck the same
 * parameter names. Both hang off the presentation language, so switching it in
 * Settings rebuilds the list and the stats shown here.
 */
export default function WordsPage() {
  const lists = useWordList()
  const { store } = useStore()
  const params = useParams<{ key?: string }>()
  const [search] = useSearchParams()
  const { state } = useLocation()

  const deck = deckFromParams(search)
  const list = listOf(lists, deck)
  const presLang = store.settings.presentationLanguage
  const options = useMemo(() => buildWordOptions(list, presLang), [list, presLang])
  const wordStats = useMemo(() => statsOf(store, deck)[presLang] ?? {}, [store, deck, presLang])

  const selectedKey = params.key === undefined ? null : decodeKeyParam(params.key)
  const selected = useMemo(() => findWordOption(options, selectedKey), [options, selectedKey])

  // A word opens at the top of its page, however far the list was scrolled.
  useEffect(() => {
    if (selectedKey !== null) scrollWindowTo(0)
  }, [selectedKey])

  if (selectedKey === null) {
    return (
      <WordBrowser
        options={options}
        wordStats={wordStats}
        deck={deck}
        presLang={presLang}
        deckError={deck === 'phrases' ? lists.phraseError : null}
      />
    )
  }

  // The filter the list had when this entry was tapped, so back returns to it.
  const back = listPath(state, deck)
  const noun = deckNoun(deck, 1)
  const nouns = deckNoun(deck)

  if (selected === null) {
    return (
      <Alert
        severity="warning"
        action={
          <Button component={RouterLink} to={back} color="inherit" size="small">
            All {nouns}
          </Button>
        }
      >
        No {presLang} {noun} matches “{selectedKey}”. It may have been renamed or removed from the{' '}
        {noun} file, or belong to another presentation language.
      </Alert>
    )
  }

  const attempts = wordStats[selected.key] ?? []

  return (
    <Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
        <IconButton
          component={RouterLink}
          to={back}
          aria-label={`Back to ${nouns}`}
          sx={{ ml: -1 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h2" noWrap sx={{ minWidth: 0 }}>
          {selected.row.texts[presLang]}
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <WordDetail
          option={selected}
          languages={list.languages}
          presLang={presLang}
          attempts={attempts}
        />

        {attempts.length > 0 && (
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography variant="subtitle2" gutterBottom>
              Accuracy over time
            </Typography>
            <WordHistoryChart attempts={attempts} />
          </Paper>
        )}

        {attempts.length > 0 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle2" gutterBottom>
              Attempts
            </Typography>
            <AttemptList attempts={attempts} />
          </Paper>
        )}
      </Stack>
    </Box>
  )
}
