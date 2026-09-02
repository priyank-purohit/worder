import type { WordRow } from './types'

/** Separator between the presentation text and the disambiguating text. */
export const KEY_SEPARATOR = '::'

/**
 * All languages except the presentation language, in header order.
 */
export function otherLanguages(languages: string[], presLang: string): string[] {
  return languages.filter((language) => language !== presLang)
}

/**
 * Stable identity of a row within one presentation language:
 * `${texts[presLang]}::${texts[other]}` where `other` is the first language in
 * header order that is not `presLang` and has a value for the row. This keeps
 * homographs apart (French "à" is both "to" and "at").
 *
 * Returns `null` when the row has no text in `presLang` — such rows are not
 * practised in that language.
 *
 * `languages` defaults to the row's own language order, which `parseWordList`
 * populates in header order.
 */
export function wordKey(
  row: WordRow,
  presLang: string,
  languages: string[] = Object.keys(row.texts),
): string | null {
  const pres = row.texts[presLang]
  if (!pres) return null
  for (const language of otherLanguages(languages, presLang)) {
    const other = row.texts[language]
    if (other) return `${pres}${KEY_SEPARATOR}${other}`
  }
  return `${pres}${KEY_SEPARATOR}`
}
