import { Alert, Link } from '@mui/material'
import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import PracticeDeck from '../components/practice/PracticeDeck'
import { useNoDocumentScroll } from '../hooks/useNoDocumentScroll'
import { useStore } from '../hooks/useStore'
import { useWordList } from '../hooks/useWordList'
import { eligibleRows } from '../lib/scheduler'

/**
 * `/` — one card at a time: reveal with a single tap or Space, then answer by
 * swiping (right = correct, left = incorrect), the buttons, or the arrow keys.
 * Grading is locked until the card has been revealed.
 *
 * The route is exactly one viewport tall and never scrolls: on a phone a
 * diagonal swipe used to scroll the page and lose the card's gesture.
 */
export default function PracticePage() {
  const { wordList } = useWordList()
  const { store } = useStore()
  const { presentationLanguage: presLang, topN, topShare } = store.settings
  const { languages, rows } = wordList

  useNoDocumentScroll()

  const eligible = useMemo(() => eligibleRows(rows, presLang), [rows, presLang])

  if (eligible.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No words have a value for <strong>{presLang || 'the current language'}</strong>. Choose
        another presentation language in{' '}
        <Link component={RouterLink} to="/settings">
          Settings
        </Link>
        .
      </Alert>
    )
  }

  return (
    // A new key starts a fresh deck whenever the draw parameters change.
    <PracticeDeck
      key={`${presLang}|${topN}|${topShare}|${rows.length}`}
      deck="words"
      rows={rows}
      languages={languages}
      presLang={presLang}
      topN={topN}
      topShare={topShare}
    />
  )
}
