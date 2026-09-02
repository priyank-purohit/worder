import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import UndoIcon from '@mui/icons-material/Undo'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { RECENT_WINDOW, pickNext } from '../../lib/scheduler'
import type { DrawSettings } from '../../lib/scheduler'
import type { Attempt, WordRow } from '../../lib/types'
import { otherLanguages, wordKey } from '../../lib/wordKey'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'
import SwipeCard from './SwipeCard'
import { useSwipe } from './useSwipe'

/** How long the "reveal first" nudge stays on the card, in ms. */
const HINT_MS = 1200

/** The answer that `Undo` would take back. One level is enough. */
interface LastAnswer {
  row: WordRow
  key: string
}

export interface PracticeDeckProps {
  /** Every row of the word file; `pickNext` applies the eligibility filter. */
  rows: WordRow[]
  /** Language names in header order. */
  languages: string[]
  /**
   * Language shown on the card. At least one row must have a value for it —
   * the page checks that and shows an explanation instead of this deck.
   */
  presLang: string
  topN: number
  topShare: number
}

/** The card on screen, plus the keys the scheduler should avoid repeating. */
interface Deck {
  card: WordRow
  recentKeys: string[]
}

/** Draw the next card, remembering the last {@link RECENT_WINDOW} keys shown. */
function drawDeck(
  rows: WordRow[],
  settings: DrawSettings,
  languages: string[],
  recentKeys: string[],
): Deck {
  const card = pickNext(rows, settings, recentKeys)
  const key = wordKey(card, settings.presentationLanguage, languages)
  return {
    card,
    recentKeys: key === null ? recentKeys : [...recentKeys, key].slice(-RECENT_WINDOW),
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

/**
 * The card, the gestures and the answer buttons. The page remounts this (via
 * `key`) whenever the draw parameters change, so a fresh deck always starts
 * from a fresh card with nothing to undo.
 */
export default function PracticeDeck({
  rows,
  languages,
  presLang,
  topN,
  topShare,
}: PracticeDeckProps) {
  const { store, recordAttempt, undoLastAttempt } = useStore()

  // The draw parameters come from the props: the page remounts this deck when
  // they change, so an unrelated settings edit cannot redraw the current card.
  const settings = useMemo<DrawSettings>(
    () => ({ presentationLanguage: presLang, topN, topShare }),
    [presLang, topN, topShare],
  )

  const keyOf = useCallback(
    (row: WordRow) => wordKey(row, presLang, languages),
    [languages, presLang],
  )

  // Drawn once on mount; every later card comes from an answer or an undo.
  const [deck, setDeck] = useState<Deck>(() => drawDeck(rows, settings, languages, []))
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState(false)
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null)
  const card = deck.card

  const hintTimer = useRef<number | null>(null)

  const clearHint = useCallback(() => {
    if (hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current)
      hintTimer.current = null
    }
    setHint(false)
  }, [])

  useEffect(() => clearHint, [clearHint])

  /** Explain, briefly, why a gesture before the reveal did nothing. */
  const showHint = useCallback(() => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    setHint(true)
    hintTimer.current = window.setTimeout(() => {
      hintTimer.current = null
      setHint(false)
    }, HINT_MS)
  }, [])

  const handleCommit = useCallback(
    (correct: boolean) => {
      const key = keyOf(card)
      if (key !== null) {
        recordAttempt(presLang, key, correct)
        setLastAnswer({ row: card, key })
      }
      // Every new card starts unrevealed, and so locked again.
      setRevealed(false)
      clearHint()
      setDeck((prev) => drawDeck(rows, settings, languages, prev.recentKeys))
    },
    [card, clearHint, keyOf, languages, presLang, recordAttempt, rows, settings],
  )

  const reveal = useCallback(() => {
    setRevealed(true)
    clearHint()
  }, [clearHint])

  const { dx, progress, phase, cardRef, handlers, fling, reset } = useSwipe({
    onCommit: handleCommit,
    onDoubleTap: reveal,
    // No grading until the answer has been seen.
    locked: !revealed,
    onBlocked: showHint,
  })

  const handleUndo = useCallback(() => {
    if (!lastAnswer) return
    undoLastAttempt(presLang, lastAnswer.key)
    reset()
    setRevealed(false)
    clearHint()
    setDeck((prev) => ({ card: lastAnswer.row, recentKeys: prev.recentKeys }))
    setLastAnswer(null)
  }, [clearHint, lastAnswer, presLang, reset, undoLastAttempt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
        event.preventDefault()
        reveal()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        // `fling` refuses (and nudges) while the card is still locked.
        fling(true)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        fling(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fling, reveal])

  const otherLangs = useMemo(() => otherLanguages(languages, presLang), [languages, presLang])

  const attempts = useMemo<Attempt[]>(() => {
    const key = keyOf(card)
    return key === null ? [] : (store.stats[presLang]?.[key] ?? [])
  }, [card, keyOf, presLang, store.stats])

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 1,
        py: 1,
        // The card flies past the viewport edge when an answer commits.
        overflowX: 'hidden',
      }}
    >
      <SwipeCard
        row={card}
        presLang={presLang}
        otherLangs={otherLangs}
        attempts={attempts}
        revealed={revealed}
        hint={hint}
        dx={dx}
        progress={progress}
        phase={phase}
        cardRef={cardRef}
        handlers={handlers}
      />

      <Stack direction="row" spacing={{ xs: 2, sm: 4 }} alignItems="center">
        <IconButton
          aria-label="Incorrect"
          onClick={() => fling(false)}
          disabled={!revealed}
          sx={{
            color: INCORRECT_COLOR,
            border: 2,
            borderColor: INCORRECT_COLOR,
            p: { xs: 1.5, sm: 2 },
          }}
        >
          <CloseIcon sx={{ fontSize: { xs: 28, sm: 34 } }} />
        </IconButton>

        <Tooltip title="Undo last answer">
          <span>
            <IconButton
              aria-label="Undo last answer"
              onClick={handleUndo}
              disabled={lastAnswer === null}
            >
              <UndoIcon />
            </IconButton>
          </span>
        </Tooltip>

        <IconButton
          aria-label="Correct"
          onClick={() => fling(true)}
          disabled={!revealed}
          sx={{
            color: CORRECT_COLOR,
            border: 2,
            borderColor: CORRECT_COLOR,
            p: { xs: 1.5, sm: 2 },
          }}
        >
          <CheckIcon sx={{ fontSize: { xs: 28, sm: 34 } }} />
        </IconButton>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        Reveal, then swipe right if you knew it, left if you did not · arrow keys work too
      </Typography>
    </Box>
  )
}
