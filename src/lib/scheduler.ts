import type { Settings, WordRow } from './types'
import { wordKey } from './wordKey'

/** How many recently shown words to avoid repeating. */
export const RECENT_WINDOW = 5

/** Rows that can be practised in the given presentation language. */
export function eligibleRows(rows: WordRow[], presLang: string): WordRow[] {
  return rows.filter((row) => Boolean(row.texts[presLang]))
}

/**
 * Draw the next word.
 *
 * - Eligible rows have a value in `settings.presentationLanguage`.
 * - The top pool is `index < settings.topN`, the rest pool is everything else.
 * - With probability `settings.topShare` the draw comes from the top pool,
 *   otherwise from the rest pool; an empty pool falls back to the other one.
 * - The last {@link RECENT_WINDOW} keys in `recentKeys` are avoided while the
 *   pool still has more than that many rows.
 *
 * Pure: all randomness comes from `rng`. Throws when nothing is eligible.
 */
export function pickNext(
  rows: WordRow[],
  settings: Settings,
  recentKeys: string[],
  rng: () => number = Math.random,
): WordRow {
  const presLang = settings.presentationLanguage
  const eligible = eligibleRows(rows, presLang)
  if (eligible.length === 0) {
    throw new Error(`No words available for "${presLang}".`)
  }

  const top = eligible.filter((row) => row.index < settings.topN)
  const rest = eligible.filter((row) => row.index >= settings.topN)

  const wantTop = rng() < settings.topShare
  const preferred = wantTop ? top : rest
  const fallback = wantTop ? rest : top
  let pool = preferred.length > 0 ? preferred : fallback

  if (pool.length > RECENT_WINDOW) {
    const recent = new Set(recentKeys.slice(-RECENT_WINDOW))
    const fresh = pool.filter((row) => {
      const key = wordKey(row, presLang)
      return key === null || !recent.has(key)
    })
    if (fresh.length > 0) pool = fresh
  }

  const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length))
  return pool[i]
}
