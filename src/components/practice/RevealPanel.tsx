import { Box, Divider, Stack, Typography } from '@mui/material'
import type { WordRow } from '../../lib/types'

export interface RevealPanelProps {
  row: WordRow
  /** Every language except the presentation language, in header order. */
  languages: string[]
}

/**
 * The answer: each other language's text, labelled with the language name.
 * Languages the row has no text for are omitted. No flip — this just appears
 * at the bottom of the card.
 */
export default function RevealPanel({ row, languages }: RevealPanelProps) {
  const lines = languages
    .map((language) => ({ language, text: row.texts[language] ?? '' }))
    .filter((line) => line.text !== '')

  if (lines.length === 0) return null

  return (
    <Stack spacing={0.5} sx={{ width: '100%' }} data-testid="reveal-panel">
      <Divider sx={{ mb: 0.5 }} />
      {lines.map(({ language, text }) => (
        <Typography
          key={language}
          variant="body2"
          sx={{ overflowWrap: 'anywhere', textAlign: 'center' }}
        >
          <Box component="span" sx={{ color: 'text.secondary', mr: 0.75 }}>
            {language}
          </Box>
          {text}
        </Typography>
      ))}
    </Stack>
  )
}
