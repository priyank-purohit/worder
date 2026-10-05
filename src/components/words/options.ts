import { joinOtherTexts, textsOf } from '../../lib/format'
import { normalizeText } from '../../lib/normalize'
import { summarize } from '../../lib/stats'
import type { DeckId, WordList, WordRow, WordStats } from '../../lib/types'
import { wordKey } from '../../lib/wordKey'

/** One browsable row, for the current presentation language. */
export interface WordOption {
  /** `wordKey(row, presLang)` — the identity stats are stored under. */
  key: string
  row: WordRow
  /** The row's other languages joined by `" / "`, precomputed for the tile. */
  others: string
  /**
   * Normalized text of every language on the row, so matching is
   * case- and diacritic-insensitive without re-folding on each keystroke.
   */
  search: string[]
}

/**
 * Every practisable row for `presLang`, in file order (= frequency rank). Rows
 * with no text in `presLang` have no key and are skipped.
 */
export function buildWordOptions(wordList: WordList, presLang: string): WordOption[] {
  const { languages, rows } = wordList
  const options: WordOption[] = []

  for (const row of rows) {
    const key = wordKey(row, presLang, languages)
    if (key === null) continue
    options.push({
      key,
      row,
      others: joinOtherTexts(row, languages, presLang),
      search: textsOf(row, languages).map(normalizeText),
    })
  }

  return options
}

/**
 * Substring match of the folded input against any language's folded text. Every
 * match is returned — the grid shows the whole list and relies on the browser
 * skipping offscreen cells.
 */
export function filterWordOptions(options: WordOption[], input: string): WordOption[] {
  const needle = normalizeText(input)
  if (needle === '') return options
  return options.filter((option) => option.search.some((text) => text.includes(needle)))
}

/** The query parameter that switches the Words tab between its two decks. */
export const SET_PARAM = 'set'

/** The deck a `/words` URL asks for: `?set=phrases`, else the words. */
export function deckFromParams(params: URLSearchParams): DeckId {
  return params.get(SET_PARAM) === 'phrases' ? 'phrases' : 'words'
}

/** The noun for a deck, singular or plural: `word` / `phrases`. */
export function deckNoun(deck: DeckId, count = 2): string {
  const singular = deck === 'phrases' ? 'phrase' : 'word'
  return count === 1 ? singular : `${singular}s`
}

/**
 * `/words` for a deck and filter: `/words`, `/words?q=eau`,
 * `/words?set=phrases&q=merci`. The words deck is the default and is left out
 * of the URL, so existing links and bookmarks keep working unchanged.
 */
export function browsePath(deck: DeckId, q = ''): string {
  const params = new URLSearchParams()
  if (deck === 'phrases') params.set(SET_PARAM, 'phrases')
  if (q !== '') params.set('q', q)
  const search = params.toString()
  return search === '' ? '/words' : `/words?${search}`
}

/** `/words/:key`, carrying the deck the same way {@link browsePath} does. */
export function detailPath(key: string, deck: DeckId): string {
  const path = `/words/${encodeURIComponent(key)}`
  return deck === 'phrases' ? `${path}?${SET_PARAM}=phrases` : path
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

/**
 * Accuracy (0–100) per word key, for the keys that have been practised. Built
 * once per render pass so a tile can colour itself with a single map lookup.
 */
export function accuracyByKey(wordStats: WordStats): Map<string, number> {
  const byKey = new Map<string, number>()
  for (const [key, attempts] of Object.entries(wordStats)) {
    const { pctCorrect } = summarize(attempts)
    if (pctCorrect !== null) byKey.set(key, pctCorrect)
  }
  return byKey
}

export interface OptionsSummary {
  /** How many words are listed. */
  words: number
  /** How many of them have at least one attempt in this language. */
  seen: number
  /** Accuracy over every attempt on the listed words; null when none. */
  pctCorrect: number | null
}

/** The count line above the grid: how many words, how many seen, how well. */
export function summarizeOptions(options: WordOption[], wordStats: WordStats): OptionsSummary {
  let seen = 0
  let attempts = 0
  let correct = 0

  for (const option of options) {
    const history = wordStats[option.key]
    if (history === undefined || history.length === 0) continue
    seen += 1
    attempts += history.length
    for (const attempt of history) if (attempt.correct) correct += 1
  }

  return {
    words: options.length,
    seen,
    pctCorrect: attempts === 0 ? null : (correct / attempts) * 100,
  }
}
