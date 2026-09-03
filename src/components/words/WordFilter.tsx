import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import { IconButton, InputAdornment, TextField } from '@mui/material'

export interface WordFilterProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Narrows the word list. Matches any language's text, ignoring case and
 * diacritics, so "etre" finds "être".
 */
export default function WordFilter({ value, onChange }: WordFilterProps) {
  return (
    <TextField
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Filter words"
      size="small"
      fullWidth
      slotProps={{
        htmlInput: {
          'aria-label': 'Filter words',
          autoCapitalize: 'none',
          autoCorrect: 'off',
          spellCheck: false,
          enterKeyHint: 'search',
        },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment:
            value === '' ? null : (
              <InputAdornment position="end">
                <IconButton aria-label="Clear filter" size="small" onClick={() => onChange('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
        },
      }}
    />
  )
}
