import { Box, Paper, Typography } from '@mui/material'

export interface StatTile {
  /** Stable slug for the tile's `data-testid` (`words-seen` -> `tile-words-seen`). */
  id: string
  /** Small caption under the value. */
  label: string
  /** The big number (or word). Always rendered on a single line. */
  value: string
}

/** Padding inside every tile — the same on all four, so their boxes match. */
const TILE_PADDING = 2

/**
 * Two tiles per row on phones, four from `md` up.
 *
 * A CSS grid rather than MUI's `Grid`: `Grid container spacing` pads its items
 * and cancels that padding with negative margins on the row, but this row
 * lives inside the `Stack` on `DashboardPage`, whose spacing reset
 * (`& > :not(style):not(style) { margin: 0 }`) outranks it on specificity. The
 * row kept `width: calc(100% + 16px)` and lost `margin-left: -16px`, so it sat
 * 16px right of the section headings and its right-hand column overhung the
 * page gutter. A grid needs no such compensation.
 *
 * `minmax(0, 1fr)` tracks (plus `minWidth: 0` on the tile) keep a long value
 * from widening its own column, and the single-line value with an ellipsised
 * caption keeps all four tiles exactly the same height.
 */
export default function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <Box
      data-testid="stat-tiles"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
        gap: '12px',
        alignItems: 'stretch',
      }}
    >
      {tiles.map((tile) => (
        <Paper
          key={tile.id}
          variant="outlined"
          data-testid={`tile-${tile.id}`}
          sx={{ p: TILE_PADDING, height: '100%', minWidth: 0, boxSizing: 'border-box' }}
        >
          <Typography
            component="p"
            sx={{
              fontWeight: 600,
              lineHeight: 1.2,
              // Grows with the phone, but never past the h4 it used to be.
              fontSize: 'clamp(1.25rem, 6vw, 2rem)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tile.value}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mt: 0.5,
              // One line, so a long caption cannot make its tile taller.
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tile.label}
          </Typography>
        </Paper>
      ))}
    </Box>
  )
}
