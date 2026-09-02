import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import { joinOtherTexts } from '../../lib/format'
import { filterWordOptions } from './options'
import type { WordOption } from './options'

interface WordSearchProps {
  options: WordOption[]
  value: WordOption | null
  /** Language names in header order. */
  languages: string[]
  /** Language shown first in each option. */
  presLang: string
  onChange: (option: WordOption | null) => void
}

/**
 * Type-ahead over every practisable row, matching any language's text
 * case- and diacritic-insensitively.
 */
export default function WordSearch({
  options,
  value,
  languages,
  presLang,
  onChange,
}: WordSearchProps) {
  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, option) => onChange(option)}
      getOptionLabel={(option) => option.label}
      // The same key can occur on more than one row, so include the row index
      // to keep React keys unique.
      getOptionKey={(option) => `${option.key}#${option.row.index}`}
      isOptionEqualToValue={(option, other) => option.key === other.key}
      filterOptions={(all, { inputValue }) => filterWordOptions(all, inputValue)}
      autoHighlight
      clearOnBlur={false}
      blurOnSelect="touch"
      fullWidth
      noOptionsText="No matching word"
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search words"
          placeholder={`${presLang} or any other language`}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...liProps } = props
        const others = joinOtherTexts(option.row, languages, presLang)
        return (
          <li key={key} {...liProps}>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="span" sx={{ display: 'block' }}>
                {option.row.texts[presLang]}
              </Typography>
              {others !== '' && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block' }}
                >
                  {others}
                </Typography>
              )}
            </Box>
          </li>
        )
      }}
      sx={{ mb: 2 }}
    />
  )
}
