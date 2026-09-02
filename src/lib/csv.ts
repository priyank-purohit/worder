import Papa from 'papaparse'
import type { WordList, WordRow } from './types'

/** Minimum number of non-empty cells a data row must have to be kept. */
const MIN_CELLS = 2

/**
 * Parse the word file. The first non-empty line is the header and holds the
 * language names; every following line is one word. Cells are trimmed, empty
 * cells are omitted, and rows with fewer than two non-empty cells are skipped
 * (their row position is still consumed, so `index` keeps tracking frequency
 * order in the file).
 */
export function parseWordList(csvText: string): WordList {
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  })

  const table = parsed.data.filter((row) => Array.isArray(row))
  const headerRow = table[0]
  if (!headerRow) return { languages: [], rows: [] }

  // Column index -> language name, skipping unnamed columns.
  const columns: { col: number; language: string }[] = []
  headerRow.forEach((cell, col) => {
    const language = (cell ?? '').trim()
    if (language !== '') columns.push({ col, language })
  })
  const languages = columns.map((c) => c.language)

  const rows: WordRow[] = []
  table.slice(1).forEach((cells, index) => {
    const texts: Record<string, string> = {}
    let filled = 0
    for (const { col, language } of columns) {
      const text = (cells[col] ?? '').trim()
      if (text === '') continue
      texts[language] = text
      filled += 1
    }
    if (filled < MIN_CELLS) return
    rows.push({ index, texts })
  })

  return { languages, rows }
}

/** Fetch and parse `public/words.csv` (respecting the Vite base path). */
export async function fetchWordList(): Promise<WordList> {
  const url = `${import.meta.env.BASE_URL}words.csv`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Could not load ${url} (HTTP ${res.status})`)
  }
  return parseWordList(await res.text())
}
