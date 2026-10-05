import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useState } from 'react'
import type { KeyboardEvent, SyntheticEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { useWordList } from '../../hooks/useWordList'
import SettingsSection from './SettingsSection'

const TOP_N_HELP = 'The first N rows of the word file are treated as most common.'
const TOP_SHARE_LABEL_ID = 'settings-top-share-label'

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

function single(value: number | number[]): number {
  return Array.isArray(value) ? value[0] : value
}

/**
 * A locally edited copy of a value the store owns: typing or dragging updates
 * the draft, and the draft adopts the store's value whenever that changes (for
 * example after an import). Adjusting state during render is React's
 * documented way to do this without an effect.
 */
function useDraft<T>(value: T): [T, (next: T) => void] {
  const [state, setState] = useState({ draft: value, source: value })
  const stale = state.source !== value
  if (stale) setState({ draft: value, source: value })
  const setDraft = useCallback((next: T) => {
    setState((prev) => ({ ...prev, draft: next }))
  }, [])
  return [stale ? value : state.draft, setDraft]
}

/** Presentation language, top-N size and the top/rest draw split. */
export default function PracticeSection() {
  const { wordList, phraseList } = useWordList()
  const { store, updateSettings } = useStore()
  const { presentationLanguage, phraseLanguage, topN, topShare } = store.settings
  const maxTopN = Math.max(1, wordList.rows.length)

  // Both fields are edited locally and committed to the store on blur / release.
  const [topNText, setTopNText] = useDraft(String(topN))
  const [share, setShare] = useDraft(topShare)

  const parsedTopN = Number(topNText.trim())
  const topNInvalid =
    topNText.trim() === '' ||
    !Number.isInteger(parsedTopN) ||
    parsedTopN < 1 ||
    parsedTopN > maxTopN
  // Only complain about what the user is currently typing, not about a stored
  // value that a smaller word file has since made too large.
  const showTopNError = topNInvalid && topNText !== String(topN)

  function commitTopN() {
    if (topNInvalid) {
      setTopNText(String(topN))
      return
    }
    if (parsedTopN !== topN) updateSettings({ topN: parsedTopN })
  }

  function handleTopNKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commitTopN()
  }

  function commitShare(_event: Event | SyntheticEvent, value: number | number[]) {
    const next = single(value)
    if (next !== topShare) updateSettings({ topShare: next })
  }

  return (
    <SettingsSection title="Practice">
      <FormControl fullWidth>
        <InputLabel id="settings-presentation-language-label">Presentation language</InputLabel>
        <Select
          labelId="settings-presentation-language-label"
          id="settings-presentation-language"
          label="Presentation language"
          value={presentationLanguage}
          onChange={(event) => updateSettings({ presentationLanguage: event.target.value })}
        >
          {wordList.languages.map((language) => (
            <MenuItem key={language} value={language}>
              {language}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Shown on the front of word cards. Stats are kept separately per presentation
          language.
        </FormHelperText>
      </FormControl>

      {phraseList.languages.length > 0 && (
        <FormControl fullWidth>
          <InputLabel id="settings-phrase-language-label">Phrase language</InputLabel>
          <Select
            labelId="settings-phrase-language-label"
            id="settings-phrase-language"
            label="Phrase language"
            value={phraseList.languages.includes(phraseLanguage) ? phraseLanguage : ''}
            onChange={(event) => updateSettings({ phraseLanguage: event.target.value })}
          >
            {phraseList.languages.map((language) => (
              <MenuItem key={language} value={language}>
                {language}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Shown on the front of phrase cards — read this, recall the rest. The Phrases tab has
            the same control.
          </FormHelperText>
        </FormControl>
      )}

      <TextField
        fullWidth
        type="number"
        label="Common words (top N)"
        value={topNText}
        error={showTopNError}
        onChange={(event) => setTopNText(event.target.value)}
        onBlur={commitTopN}
        onKeyDown={handleTopNKeyDown}
        slotProps={{ htmlInput: { min: 1, max: maxTopN, step: 1, inputMode: 'numeric' } }}
        helperText={
          showTopNError ? `Enter a whole number from 1 to ${maxTopN}. ${TOP_N_HELP}` : TOP_N_HELP
        }
      />

      <Box>
        <Typography id={TOP_SHARE_LABEL_ID} variant="body2" gutterBottom>
          Share of cards drawn from the top words
        </Typography>
        <Slider
          value={share}
          min={0}
          max={1}
          step={0.05}
          marks={[
            { value: 0, label: '0%' },
            { value: 0.5, label: '50%' },
            { value: 1, label: '100%' },
          ]}
          valueLabelDisplay="auto"
          valueLabelFormat={percent}
          aria-labelledby={TOP_SHARE_LABEL_ID}
          onChange={(_event, value) => setShare(single(value))}
          onChangeCommitted={commitShare}
          sx={{ mx: 1, width: 'calc(100% - 16px)' }}
        />
        <Typography variant="caption" color="text.secondary" component="p">
          {percent(share)} of cards come from the top {topN.toLocaleString()}, {percent(1 - share)}{' '}
          from the rest
        </Typography>
      </Box>
    </SettingsSection>
  )
}
