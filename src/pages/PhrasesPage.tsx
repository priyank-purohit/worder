import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import TranslateIcon from '@mui/icons-material/Translate'
import {
  Alert,
  Box,
  Button,
  Link,
  Menu,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import PhraseStats from '../components/phrases/PhraseStats'
import PracticeDeck from '../components/practice/PracticeDeck'
import { useNoDocumentScroll } from '../hooks/useNoDocumentScroll'
import { useStore } from '../hooks/useStore'
import { useWordList } from '../hooks/useWordList'
import { eligibleRows } from '../lib/scheduler'

/**
 * A phrase is several words on one card, so it wraps into lines: cap the
 * fitted size well under a single word's 56 / 64 px so four lines still fit.
 */
const PHRASE_MAX_FONT_PX = 36

export const PHRASES_PATH = '/phrases'
export const PHRASE_STATS_PATH = '/phrases/stats'

type PhrasesView = 'practice' | 'stats'

/**
 * Which language goes on the front of a phrase card. Its own setting, apart
 * from the word deck's: read the English and recall the French, while words
 * are still practised the other way round. Each language keeps its own stats.
 */
function PhraseLanguageMenu({
  languages,
  value,
  onChange,
}: {
  languages: string[]
  value: string
  onChange: (language: string) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = anchor !== null

  function choose(language: string) {
    setAnchor(null)
    if (language !== value) onChange(language)
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        // The icon is the first thing to go on a phone, so "Phrases" still fits.
        startIcon={<TranslateIcon />}
        endIcon={<ArrowDropDownIcon />}
        aria-label={`Phrase language: ${value}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        sx={{
          flexShrink: 0,
          minWidth: 0,
          textTransform: 'none',
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
        }}
      >
        {value}
      </Button>
      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
        {languages.map((language) => (
          <MenuItem key={language} selected={language === value} onClick={() => choose(language)}>
            {language}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

/**
 * `/phrases` — the phrase deck. Two views under one tab: **Practice** is the
 * same one-viewport card as `/`, drawn uniformly from the whole list (every
 * phrase is a common one, so there is no top/rest split), and **Stats** is the
 * deck's own dashboard. The front-of-card language is `settings.phraseLanguage`
 * (English by default), picked from the header; answers go to `phraseStats`,
 * never to the word stats.
 */
export default function PhrasesPage() {
  const { phraseList, phraseError } = useWordList()
  const { store, updateSettings } = useStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const presLang = store.settings.phraseLanguage
  const { languages, rows } = phraseList

  const view: PhrasesView = pathname === PHRASE_STATS_PATH ? 'stats' : 'practice'

  const eligible = useMemo(() => eligibleRows(rows, presLang), [rows, presLang])
  const phraseStats = useMemo(
    () => store.phraseStats[presLang] ?? {},
    [store.phraseStats, presLang],
  )

  // Only the card view pins the document; the stats view scrolls as usual.
  useNoDocumentScroll(view === 'practice' && eligible.length > 0)

  let body
  if (phraseError !== null) {
    body = <Alert severity="warning">Phrases are unavailable: {phraseError}</Alert>
  } else if (eligible.length === 0) {
    body = (
      <Alert severity="info">
        No phrases have a value for <strong>{presLang || 'the current language'}</strong>. Pick
        another phrase language above or in{' '}
        <Link component={RouterLink} to="/settings">
          Settings
        </Link>
        .
      </Alert>
    )
  } else if (view === 'stats') {
    body = (
      <PhraseStats
        phraseList={phraseList}
        phraseStats={phraseStats}
        presLang={presLang}
        eligibleCount={eligible.length}
      />
    )
  } else {
    body = (
      // A new key starts a fresh deck whenever the draw parameters change.
      <PracticeDeck
        key={`${presLang}|${rows.length}`}
        deck="phrases"
        rows={rows}
        languages={languages}
        presLang={presLang}
        // Every phrase in the top pool: a uniform draw over the whole list.
        topN={Number.MAX_SAFE_INTEGER}
        topShare={1}
        maxFontPx={PHRASE_MAX_FONT_PX}
      />
    )
  }

  return (
    // In the practice view this column is clipped to the viewport (`Layout`
    // gives `/phrases` the fixed shell), so the deck must be able to shrink.
    <Box
      sx={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ flexShrink: 0, flexWrap: 'nowrap' }}
      >
        {/* Smaller on a phone, where it shares the row with two controls; it
            still gives way first if something has to. */}
        <Typography
          variant="h5"
          component="h2"
          noWrap
          sx={{ flex: '1 1 auto', minWidth: 0, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
        >
          Phrases
        </Typography>
        {languages.length > 0 && (
          <PhraseLanguageMenu
            languages={languages}
            value={presLang}
            onChange={(phraseLanguage) => updateSettings({ phraseLanguage })}
          />
        )}
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={view}
          aria-label="Phrases view"
          sx={{ flexShrink: 0 }}
          onChange={(_event, next: PhrasesView | null) => {
            if (next !== null) navigate(next === 'stats' ? PHRASE_STATS_PATH : PHRASES_PATH)
          }}
        >
          <ToggleButton value="practice">Practice</ToggleButton>
          <ToggleButton value="stats">Stats</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {body}
    </Box>
  )
}
