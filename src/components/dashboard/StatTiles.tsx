import { Grid, Paper, Typography } from '@mui/material'

export interface StatTile {
  /** Small caption under the value. */
  label: string
  /** The big number (or word). */
  value: string
}

/** `Words seen` -> `tile-words-seen`, so each tile is addressable. */
function testId(label: string): string {
  return `tile-${label.toLowerCase().replace(/\s+/g, '-')}`
}

/** Two tiles per row on phones, four on desktop. */
export default function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <Grid container spacing={2}>
      {tiles.map((tile) => (
        <Grid item xs={6} md={3} key={tile.label}>
          <Paper variant="outlined" data-testid={testId(tile.label)} sx={{ p: 2, height: '100%' }}>
            <Typography
              component="p"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                overflowWrap: 'anywhere',
                typography: { xs: 'h5', sm: 'h4' },
              }}
            >
              {tile.value}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5 }}
            >
              {tile.label}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  )
}
