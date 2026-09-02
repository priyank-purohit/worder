import { Alert, Box, Paper, Stack, Typography } from '@mui/material'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AttemptList from '../components/words/AttemptList'
import WordDetail from '../components/words/WordDetail'
import WordHistoryChart from '../components/words/WordHistoryChart'
import WordSearch from '../components/words/WordSearch'
import { buildWordOptions, decodeKeyParam, findWordOption } from '../components/words/options'
import type { WordOption } from '../components/words/options'
import { useStore } from '../hooks/useStore'
import { useWordList } from '../hooks/useWordList'

/** Search for a word and see how it has gone so far. */
export default function WordsPage() {
  const { wordList } = useWordList()
  const { store } = useStore()
  const navigate = useNavigate()
  const params = useParams<{ key?: string }>()

  // Everything hangs off the presentation language, so switching it in Settings
  // rebuilds the search and the stats shown here.
  const presLang = store.settings.presentationLanguage
  const options = useMemo(() => buildWordOptions(wordList, presLang), [wordList, presLang])

  const selectedKey = params.key === undefined ? null : decodeKeyParam(params.key)
  const selected = useMemo(() => findWordOption(options, selectedKey), [options, selectedKey])
  const attempts = selected === null ? [] : (store.stats[presLang]?.[selected.key] ?? [])

  const handleChange = useCallback(
    (option: WordOption | null) => {
      navigate(option === null ? '/words' : `/words/${encodeURIComponent(option.key)}`)
    },
    [navigate],
  )

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Words
      </Typography>

      <WordSearch
        options={options}
        value={selected}
        languages={wordList.languages}
        presLang={presLang}
        onChange={handleChange}
      />

      {selectedKey !== null && selected === null && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No {presLang} word matches “{selectedKey}”. It may have been renamed or removed from the
          word file, or belong to another presentation language.
        </Alert>
      )}

      {selected === null ? (
        <Typography variant="body2" color="text.secondary">
          {options.length} {presLang} words. Search in any language to see a word’s history.
        </Typography>
      ) : (
        <Stack spacing={2}>
          <WordDetail
            option={selected}
            languages={wordList.languages}
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
      )}
    </Box>
  )
}
