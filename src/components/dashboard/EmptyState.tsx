import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { CHART_HEIGHT } from '../chartOptions'

/** Placeholder shown in place of a chart or table that has no data yet. */
export default function EmptyState({
  children,
  minHeight = CHART_HEIGHT,
}: {
  children: ReactNode
  minHeight?: number
}) {
  return (
    <Box
      sx={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  )
}
