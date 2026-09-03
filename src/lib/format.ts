import type { WordRow } from './types'
import { otherLanguages } from './wordKey'

/** How translations are joined wherever several are shown on one line. */
const TEXT_SEPARATOR = ' / '

/** The texts of `languages` that this row actually has, in header order. */
export function textsOf(row: WordRow, languages: string[]): string[] {
  return languages
    .map((language) => row.texts[language] as string | undefined)
    .filter((text): text is string => text !== undefined && text !== '')
}

/** The row's texts in every language except `presLang`, in header order. */
function otherTexts(row: WordRow, languages: string[], presLang: string): string[] {
  return textsOf(row, otherLanguages(languages, presLang))
}

/** {@link otherTexts} as one line: `"water / પાણી"`. */
export function joinOtherTexts(row: WordRow, languages: string[], presLang: string): string {
  return otherTexts(row, languages, presLang).join(TEXT_SEPARATOR)
}
