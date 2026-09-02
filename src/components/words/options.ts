import { TEXT_SEPARATOR, otherTexts, textsOf } from '../../lib/format'
import { normalizeText } from '../../lib/normalize'
import type { WordList, WordRow } from '../../lib/types'
import { wordKey } from '../../lib/wordKey'

/** One searchable row, for the current presentation language. */
export interface WordOption {
  /** `wordKey(row, presLang)` — the identity stats are stored under. */
  key: string
  row: WordRow
  /** `<presWord> — <other texts joined by " / ">`. */
  label: string
  /**
   * Normalized text of every language on the row, so matching is
   * case- and diacritic-insensitive without re-folding on each keystroke.
   */
  search: string[]
}

/** How many matches the Autocomplete shows at once. */
export const MAX_OPTIONS = 50

/**
 * Every practisable row for `presLang`, in file order. Rows with no text in
 * `presLang` have no key and are skipped.
 */
export function buildWordOptions(wordList: WordList, presLang: string): WordOption[] {
  const { languages, rows } = wordList
  const options: WordOption[] = []

  for (const row of rows) {
    const key = wordKey(row, presLang, languages)
    if (key === null) continue
    const pres = row.texts[presLang]
    const rest = otherTexts(row, languages, presLang)
    options.push({
      key,
      row,
      label: rest.length > 0 ? `${pres} — ${rest.join(TEXT_SEPARATOR)}` : pres,
      search: textsOf(row, languages).map(normalizeText),
    })
  }

  return options
}

/**
 * Substring match of the folded input against any language's folded text,
 * capped at `limit` so a large word file stays responsive.
 */
export function filterWordOptions(
  options: WordOption[],
  input: string,
  limit: number = MAX_OPTIONS,
): WordOption[] {
  const needle = normalizeText(input)
  if (needle === '') return options.slice(0, limit)

  const matches: WordOption[] = []
  for (const option of options) {
    if (option.search.some((text) => text.includes(needle))) {
      matches.push(option)
      if (matches.length >= limit) break
    }
  }
  return matches
}

/**
 * The word key held in the `/words/:key` path param. react-router already
 * percent-decodes path segments; it only leaves `/` encoded so that a param
 * cannot split into two segments, so that is all there is left to undo.
 */
export function decodeKeyParam(param: string): string {
  return param.replace(/%2F/gi, '/')
}

/** The option for a key, or null when the word file no longer has it. */
export function findWordOption(options: WordOption[], key: string | null): WordOption | null {
  if (key === null) return null
  return options.find((option) => option.key === key) ?? null
}
