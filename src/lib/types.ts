/** A single row of the word file. */
export interface WordRow {
  /** 0-based row position in the file (after the header row). */
  index: number
  /** language name -> text (missing/empty cells are omitted). */
  texts: Record<string, string>
}

/** The parsed word file. */
export interface WordList {
  /** Language names, in header order. */
  languages: string[]
  rows: WordRow[]
}

/** One practice attempt. `t` is epoch milliseconds. */
export interface Attempt {
  t: number
  correct: boolean
}

/** Which palette to use. `system` follows the device's colour scheme. */
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Settings {
  /** Language shown on the front of the card. */
  presentationLanguage: string
  /** How many leading rows count as "common" words. */
  topN: number
  /** Probability that a draw comes from the top-N pool (0..1). */
  topShare: number
  /** Light / dark preference. Added after v1 shipped; missing means `system`. */
  themeMode: ThemeMode
}

/** wordKey -> attempts, chronological. */
export type WordStats = Record<string, Attempt[]>

/** presentationLanguage -> wordKey -> attempts. */
export type AllStats = Record<string, WordStats>

export interface Store {
  version: 1
  settings: Settings
  stats: AllStats
}
