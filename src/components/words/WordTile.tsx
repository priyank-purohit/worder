import { ButtonBase } from '@mui/material'
import { memo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import type { DeckId } from '../../lib/types'
import { detailPath } from './options'
import type { WordOption } from './options'

export interface WordTileProps {
  option: WordOption
  /** Which deck the list is showing; the detail link carries it along. */
  deck: DeckId
  presLang: string
  /** Accuracy 0–100, or null when the word has never been practised. */
  pct: number | null
  /** The list's current filter, carried along so the back link can restore it. */
  q: string
  /** Called just before navigating, so the list can remember where it was. */
  onNavigate: () => void
}

/** Accuracy bands the left border colour-codes. */
const GOOD = 70
const SHAKY = 40

/**
 * The accuracy modifier class. The colours live in `WordGrid`'s style block so
 * that two thousand tiles share one set of rules.
 */
function accentClass(pct: number | null): string {
  if (pct === null) return ''
  if (pct >= GOOD) return ' WordTile--good'
  if (pct >= SHAKY) return ' WordTile--shaky'
  return ' WordTile--poor'
}

/**
 * One cell of the word grid: the presentation word, its rank in the word file,
 * and its other languages on a second line. Deliberately plain — a `ButtonBase`
 * wrapping spans that the grid styles by class name, because the whole list is
 * on the page at once and a `Paper`/`Typography` per cell is not affordable.
 */
function WordTile({ option, deck, presLang, pct, q, onNavigate }: WordTileProps) {
  const { row, others } = option
  const word = row.texts[presLang]
  const rank = row.index + 1

  return (
    <ButtonBase
      className={`WordTile${accentClass(pct)}`}
      component={RouterLink}
      to={detailPath(option.key, deck)}
      state={{ q }}
      onClick={onNavigate}
      // No ripple: it would mount a TouchRipple for every cell in the list.
      disableRipple
      aria-label={`${word}${others === '' ? '' : ` — ${others}`}, rank ${rank}`}
    >
      <span className="WordTile-head">
        <span className="WordTile-word">{word}</span>
        <span className="WordTile-rank" aria-hidden="true">
          #{rank}
        </span>
      </span>
      {others !== '' && <span className="WordTile-others">{others}</span>}
    </ButtonBase>
  )
}

export default memo(WordTile)
