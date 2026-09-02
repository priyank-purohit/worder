import { Chip, Stack, Typography } from '@mui/material'
import { useStore } from '../../hooks/useStore'
import { useWordList } from '../../hooks/useWordList'
import { eligibleRows } from '../../lib/scheduler'
import SettingsSection from './SettingsSection'

/** What the loaded `words.csv` contains. */
export default function WordFileSection() {
  const { wordList } = useWordList()
  const { store } = useStore()
  const presLang = store.settings.presentationLanguage
  const eligible = eligibleRows(wordList.rows, presLang).length

  return (
    <SettingsSection title="Word file">
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {wordList.languages.map((language) => (
            <Chip
              key={language}
              label={language}
              size="small"
              color={language === presLang ? 'primary' : 'default'}
              variant={language === presLang ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2">
            {wordList.rows.length.toLocaleString()} rows in total
          </Typography>
          <Typography variant="body2">
            {eligible.toLocaleString()} rows have a {presLang || 'presentation language'} word and
            can be practised
          </Typography>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          To use another language, replace public/words.csv and redeploy.
        </Typography>
      </Stack>
    </SettingsSection>
  )
}
