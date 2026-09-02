import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { joinOtherTexts } from '../../lib/format'
import type { HardWord } from '../../lib/stats'
import type { WordRow } from '../../lib/types'
import { KEY_SEPARATOR } from '../../lib/wordKey'
import EmptyState from './EmptyState'

export interface HardestWordsTableProps {
  words: HardWord[]
  /** wordKey -> row, for the current presentation language. */
  rowsByKey: Map<string, WordRow>
  presLang: string
  languages: string[]
}

/** Presentation text and translations for a stats key, falling back to the key itself. */
function labelsFor(
  key: string,
  row: WordRow | undefined,
  presLang: string,
  languages: string[],
): { word: string; translation: string } {
  if (row) {
    return {
      word: row.texts[presLang] ?? '',
      translation: joinOtherTexts(row, languages, presLang),
    }
  }
  // The word file no longer has this row (e.g. it was edited after practising).
  const at = key.indexOf(KEY_SEPARATOR)
  if (at === -1) return { word: key, translation: '' }
  return { word: key.slice(0, at), translation: key.slice(at + KEY_SEPARATOR.length) }
}

/** Worst accuracy first; every row links to the word's detail page. */
export default function HardestWordsTable({
  words,
  rowsByKey,
  presLang,
  languages,
}: HardestWordsTableProps) {
  if (words.length === 0) {
    return <EmptyState minHeight={120}>Words appear here after 3+ attempts.</EmptyState>
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Word</TableCell>
          <TableCell>Translation</TableCell>
          <TableCell align="right">Seen</TableCell>
          <TableCell align="right">% correct</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {words.map((word) => {
          const { word: text, translation } = labelsFor(
            word.key,
            rowsByKey.get(word.key),
            presLang,
            languages,
          )
          return (
            <TableRow key={word.key} hover>
              <TableCell>
                <Link
                  component={RouterLink}
                  to={`/words/${encodeURIComponent(word.key)}`}
                  underline="hover"
                  sx={{ fontWeight: 600 }}
                >
                  {text}
                </Link>
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>{translation}</TableCell>
              <TableCell align="right">{word.seen}</TableCell>
              <TableCell align="right">{Math.round(word.pctCorrect)}%</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
