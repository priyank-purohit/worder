import { Box, Paper, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { RefObject } from 'react'
import type { Summary } from '../../lib/stats'
import type { WordRow } from '../../lib/types'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'
import RevealPanel from './RevealPanel'
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
  summary: Summary
  revealed: boolean
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

function caption(row: WordRow, summary: Summary): string {
  const rank = `#${row.index + 1}`
  if (summary.seen === 0 || summary.pctCorrect === null) return rank
  return `${rank} · seen ${summary.seen}× · ${Math.round(summary.pctCorrect)}% correct`
}

/**
 * The draggable practice card. Purely presentational: all gesture state comes
 * from `useSwipe` so the page can also drive it from the buttons and keyboard.
 */
export default function SwipeCard({
  row,
  presLang,
  otherLangs,
  summary,
  revealed,
  dx,
  progress,
  phase,
  cardRef,
  handlers,
}: SwipeCardProps) {
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
      aria-label={`Card ${row.index + 1}: ${row.texts[presLang] ?? ''}`}
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

      <Typography variant="caption" color="text.secondary" sx={{ position: 'relative' }}>
        {caption(row, summary)}
      </Typography>

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
          data-testid="practice-word"
          lang={presLang}
          sx={{
            fontSize: 'clamp(2rem, 8vw, 4rem)',
            fontWeight: 600,
            lineHeight: 1.15,
            textAlign: 'center',
            overflowWrap: 'anywhere',
            hyphens: 'auto',
          }}
        >
          {row.texts[presLang] ?? ''}
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', width: '100%', minHeight: 44 }}>
        {revealed ? (
          <RevealPanel row={row} languages={otherLangs} />
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
