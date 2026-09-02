import CancelIcon from '@mui/icons-material/Cancel'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { Chip, List, ListItem, ListItemText, Typography } from '@mui/material'
import type { Attempt } from '../../lib/types'

/** Longest list we render; older attempts are only counted. */
const MAX_ROWS = 50

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Every attempt on one word, newest first. */
export default function AttemptList({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return null

  const newestFirst = attempts.slice().reverse()
  const shown = newestFirst.slice(0, MAX_ROWS)

  return (
    <>
      <List dense disablePadding>
        {shown.map((attempt, i) => (
          <ListItem
            key={`${attempt.t}-${newestFirst.length - i}`}
            divider={i < shown.length - 1}
            disableGutters
            secondaryAction={
              <Chip
                size="small"
                variant="outlined"
                color={attempt.correct ? 'success' : 'error'}
                icon={attempt.correct ? <CheckCircleIcon /> : <CancelIcon />}
                label={attempt.correct ? 'Correct' : 'Incorrect'}
              />
            }
          >
            <ListItemText
              primary={dateTimeFormat.format(attempt.t)}
              secondary={`attempt ${newestFirst.length - i}`}
              slotProps={{
                primary: { variant: 'body2' },
                secondary: { variant: 'caption' },
              }}
            />
          </ListItem>
        ))}
      </List>
      {attempts.length > MAX_ROWS && (
        <Typography variant="caption" color="text.secondary">
          Showing the latest {MAX_ROWS} of {attempts.length} attempts.
        </Typography>
      )}
    </>
  )
}
