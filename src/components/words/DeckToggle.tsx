import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { DeckId } from '../../lib/types'

export interface DeckToggleProps {
  value: DeckId
  onChange: (deck: DeckId) => void
}

/** Words | Phrases — which deck the Words tab is browsing. */
export default function DeckToggle({ value, onChange }: DeckToggleProps) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      value={value}
      aria-label="Deck"
      onChange={(_event, next: DeckId | null) => {
        // Clicking the pressed button again yields null; the deck stays put.
        if (next !== null) onChange(next)
      }}
    >
      <ToggleButton value="words">Words</ToggleButton>
      <ToggleButton value="phrases">Phrases</ToggleButton>
    </ToggleButtonGroup>
  )
}
