import { Box } from '@mui/material'
import type { Attempt } from '../../lib/types'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'

/** How many of the most recent attempts the row shows. */
export const HISTORY_LIMIT = 10
/** Diameter of one dot, in px. */
const DOT_PX = 9
/** Gap between dots, in px. */
const GAP_PX = 4

export interface HistoryDotsProps {
  /** The word's attempts, chronological. Only the last `limit` are shown. */
  attempts: Attempt[]
  limit?: number
}

/**
 * One small dot per recent attempt, oldest on the left: green for correct, red
 * for incorrect. Renders nothing for a word that has never been seen.
 *
 * The row never wraps and never shrinks, so it stays on the card header's one
 * line next to the rank even on a narrow phone.
 */
export default function HistoryDots({ attempts, limit = HISTORY_LIMIT }: HistoryDotsProps) {
  const shown = attempts.slice(-limit)
  if (shown.length === 0) return null

  const label = `Last ${shown.length} results: ${shown
    .map((attempt) => (attempt.correct ? 'correct' : 'incorrect'))
    .join(', ')}`

  return (
    <Box
      // A bare div's aria-label is ignored, so the row names itself as an image
      // and its dots stay out of the accessibility tree.
      role="img"
      aria-label={label}
      data-testid="history-dots"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: `${GAP_PX}px`,
        flexWrap: 'nowrap',
        flexShrink: 0,
      }}
    >
      {shown.map((attempt, i) => (
        <Box
          key={`${attempt.t}-${i}`}
          data-testid={attempt.correct ? 'history-dot-correct' : 'history-dot-incorrect'}
          sx={{
            width: DOT_PX,
            height: DOT_PX,
            flexShrink: 0,
            borderRadius: '50%',
            backgroundColor: attempt.correct ? CORRECT_COLOR : INCORRECT_COLOR,
          }}
        />
      ))}
    </Box>
  )
}
