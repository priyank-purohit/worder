import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import { Fragment } from 'react'
import { summarize } from '../../lib/stats'
import type { Attempt } from '../../lib/types'
import type { WordOption } from './options'

interface WordDetailProps {
  option: WordOption
  /** Language names in header order. */
  languages: string[]
  presLang: string
  attempts: Attempt[]
}

/** Every text on the row, its rank in the word file, and its score so far. */
export default function WordDetail({ option, languages, presLang, attempts }: WordDetailProps) {
  const { row } = option
  const { seen, correct, incorrect, pctCorrect } = summarize(attempts)

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" component="h3" sx={{ wordBreak: 'break-word' }}>
        {row.texts[presLang]}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {presLang} · rank #{row.index + 1}
      </Typography>

      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(6rem, max-content) 1fr' },
          columnGap: 2,
          rowGap: { xs: 0.5, sm: 1 },
          my: 2,
        }}
      >
        {languages
          .filter((language) => Boolean(row.texts[language]))
          .map((language) => (
            <Fragment key={language}>
              <Typography component="dt" variant="body2" color="text.secondary" sx={{ m: 0 }}>
                {language}
              </Typography>
              <Typography
                component="dd"
                sx={{
                  m: 0,
                  mb: { xs: 1, sm: 0 },
                  fontWeight: language === presLang ? 600 : 400,
                  wordBreak: 'break-word',
                }}
              >
                {row.texts[language]}
              </Typography>
            </Fragment>
          ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {seen === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Not practised yet — it has no history in {presLang}.
        </Typography>
      ) : (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip label={`seen ${seen}×`} size="small" />
          <Chip label={`${correct} correct`} size="small" color="success" />
          <Chip label={`${incorrect} incorrect`} size="small" color="error" />
          <Chip
            label={`${Math.round(pctCorrect ?? 0)}% correct`}
            size="small"
            variant="outlined"
          />
        </Stack>
      )}
    </Paper>
  )
}
