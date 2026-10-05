import { Box } from '@mui/material'
import type { DeckId } from '../../lib/types'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'
import WordTile from './WordTile'
import type { WordOption } from './options'

export interface WordGridProps {
  /** Words to show, in file order (= frequency rank). */
  options: WordOption[]
  deck: DeckId
  presLang: string
  /** wordKey -> accuracy 0–100, for the words that have been practised. */
  accuracy: Map<string, number>
  /** The list's current filter, carried into each tile's link. */
  q: string
  onNavigate: () => void
}

/**
 * The whole word list as a responsive grid of tiles — two columns on a phone,
 * six or more on a desktop — so it can just be scrolled through.
 *
 * Every tile is on the page at once (about two thousand of them), so all the
 * styling is declared here once and the tiles only carry class names;
 * `content-visibility` lets the browser skip laying out what is offscreen.
 */
export default function WordGrid({
  options,
  deck,
  presLang,
  accuracy,
  q,
  onNavigate,
}: WordGridProps) {
  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 1,

        '& .WordTile': {
          display: 'block',
          width: '100%',
          minWidth: 0,
          textAlign: 'left',
          px: 1,
          py: 0.75,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderLeftWidth: 4,
          borderLeftColor: 'divider',
          bgcolor: 'background.paper',
          // Skip the cells that are far offscreen; the intrinsic size keeps the
          // scrollbar honest while they are skipped.
          contentVisibility: 'auto',
          containIntrinsicSize: '56px',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}` },
        },
        // Colour-coded accuracy, matching the charts.
        '& .WordTile--good': { borderLeftColor: CORRECT_COLOR },
        '& .WordTile--shaky': { borderLeftColor: 'warning.main' },
        '& .WordTile--poor': { borderLeftColor: INCORRECT_COLOR },

        '& .WordTile-head': {
          display: 'flex',
          alignItems: 'baseline',
          gap: 0.5,
          minWidth: 0,
        },
        '& .WordTile-word': {
          ...theme.typography.body1,
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        '& .WordTile-rank': {
          ...theme.typography.caption,
          color: 'text.disabled',
          flexShrink: 0,
        },
        '& .WordTile-others': {
          ...theme.typography.caption,
          display: 'block',
          color: 'text.secondary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      })}
    >
      {options.map((option) => (
        // The same key can occur on more than one row, so include the row index.
        <WordTile
          key={`${option.key}#${option.row.index}`}
          option={option}
          deck={deck}
          presLang={presLang}
          pct={accuracy.get(option.key) ?? null}
          q={q}
          onNavigate={onNavigate}
        />
      ))}
    </Box>
  )
}
