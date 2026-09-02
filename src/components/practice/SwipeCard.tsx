import { Box, Fade, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { RefObject } from 'react'
import type { Attempt, WordRow } from '../../lib/types'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'
import HistoryDots from './HistoryDots'
import RevealPanel from './RevealPanel'
import { MAX_FONT_PX, PHONE_MAX_FONT_PX, isSingleToken, useFitText } from './useFitText'
import { EXIT_MS, RETURN_MS } from './useSwipe'
import type { SwipeHandlers, SwipePhase } from './useSwipe'

/** `rotate(dx / 20 deg)`, per the spec. */
const ROTATION_DIVISOR = 20
/** Keeps the fly-off from spinning: a drag never reaches this much rotation. */
const MAX_ROTATION_DEG = 20
/** Alpha of the green/red wash at full commit distance. */
const TINT_ALPHA = 0.35

export interface SwipeCardProps {
  row: WordRow
  /** Language shown large on the card. */
  presLang: string
  /** Languages revealed at the bottom, in header order. */
  otherLangs: string[]
  /** The word's attempts in this language, chronological. */
  attempts: Attempt[]
  revealed: boolean
  /** True while the "reveal first" nudge is showing. */
  hint: boolean
  dx: number
  progress: number
  phase: SwipePhase
  cardRef: RefObject<HTMLDivElement>
  handlers: SwipeHandlers
}

function transitionFor(phase: SwipePhase): string {
  if (phase === 'exit') return `transform ${EXIT_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
  // Slight overshoot on the way back, for a springy feel.
  if (phase === 'return') return `transform ${RETURN_MS}ms cubic-bezier(0.34, 1.36, 0.64, 1)`
  return 'none'
}

/**
 * The draggable practice card. Purely presentational: all gesture state comes
 * from `useSwipe` so the page can also drive it from the buttons and keyboard.
 */
export default function SwipeCard({
  row,
  presLang,
  otherLangs,
  attempts,
  revealed,
  hint,
  dx,
  progress,
  phase,
  cardRef,
  handlers,
}: SwipeCardProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const word = row.texts[presLang] ?? ''
  const { ref: wordRef, fontSize } = useFitText<HTMLParagraphElement>(
    word,
    phone ? PHONE_MAX_FONT_PX : MAX_FONT_PX,
  )

  const rotation = Math.max(
    -MAX_ROTATION_DEG,
    Math.min(MAX_ROTATION_DEG, dx / ROTATION_DIVISOR),
  )
  const tint = progress >= 0 ? CORRECT_COLOR : INCORRECT_COLOR

  return (
    <Paper
      ref={cardRef}
      elevation={4}
      data-testid="practice-card"
      // A bare div's aria-label is ignored, so name a group instead.
      role="group"
      aria-label={`Card ${row.index + 1}: ${word}`}
      {...handlers}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: 'min(92vw, 480px)',
        minHeight: { xs: '55vh', sm: 420 },
        p: { xs: 2, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        // `manipulation` lets the browser claim a horizontal pan: it fires
        // `pointercancel` after the first touchmove and the swipe never
        // commits. `pan-y` keeps vertical page scrolling and still blocks
        // double-tap zoom, so a double tap reveals instead of zooming.
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        willChange: 'transform',
        transform: `translateX(${dx}px) rotate(${rotation}deg)`,
        transition: transitionFor(phase),
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundColor: alpha(tint, TINT_ALPHA),
          opacity: Math.min(1, Math.abs(progress)),
          transition: phase === 'drag' ? 'none' : 'opacity 200ms ease-out',
        }}
      />

      {/* Rank, then the recent results beside it — always on one line. */}
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        data-testid="card-header"
        sx={{ position: 'relative', flexWrap: 'nowrap', maxWidth: '100%' }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {`#${row.index + 1}`}
        </Typography>
        <HistoryDots attempts={attempts} />
      </Stack>

      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Typography
          component="p"
          ref={wordRef}
          data-testid="practice-word"
          lang={presLang}
          sx={{
            // Full width so the fitted size is measured against the space the
            // word may actually use.
            width: '100%',
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            lineHeight: 1.15,
            textAlign: 'center',
            // The fitted size already guarantees the longest token fits, so a
            // line may only ever break at a space — never inside a word.
            overflowWrap: 'normal',
            wordBreak: 'keep-all',
            hyphens: 'none',
            textWrap: 'balance',
            ...(isSingleToken(word) ? { whiteSpace: 'nowrap' } : null),
          }}
        >
          {word}
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', width: '100%', minHeight: 44 }}>
        {revealed ? (
          <RevealPanel row={row} languages={otherLangs} />
        ) : hint ? (
          <Fade in appear timeout={180}>
            <Typography
              variant="caption"
              color="warning.main"
              // Announced too: a screen-reader user gets no other explanation
              // for the disabled answer buttons.
              role="status"
              data-testid="reveal-hint"
              sx={{ display: 'block', textAlign: 'center', fontWeight: 600 }}
            >
              Reveal the translation first
            </Typography>
          </Fade>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center' }}
          >
            Double-tap or press Space to reveal
          </Typography>
        )}
      </Box>
    </Paper>
  )
}
