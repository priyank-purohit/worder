/**
 * Where the word list was left, so coming back from a word's page lands in the
 * same place instead of at the top of two thousand words. Kept in
 * `sessionStorage` (per tab, gone when it closes) and always guarded: a browser
 * may refuse storage entirely, and the list must still work when it does.
 */

const SCROLL_KEY = 'worder:words:scroll'
const FILTER_KEY = 'worder:words:q'

function session(): Storage | null {
  try {
    if (typeof globalThis.sessionStorage === 'undefined') return null
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

function read(key: string): string | null {
  try {
    return session()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    session()?.setItem(key, value)
  } catch {
    // Nothing to do: the list simply starts from the top next time.
  }
}

/** Leaving the list: remember the filter and how far down it was scrolled. */
export function rememberList(q: string, scrollY: number): void {
  write(FILTER_KEY, q)
  write(SCROLL_KEY, String(Math.round(scrollY)))
}

/** The remembered scroll offset, consumed so a later visit starts at the top. */
export function takeScroll(): number {
  const raw = read(SCROLL_KEY)
  try {
    session()?.removeItem(SCROLL_KEY)
  } catch {
    // Ignored — the value is only a convenience.
  }
  const y = raw === null ? Number.NaN : Number.parseInt(raw, 10)
  return Number.isFinite(y) && y > 0 ? y : 0
}

function filterFromState(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const q = (state as { q?: unknown }).q
  return typeof q === 'string' ? q : null
}

/**
 * Where a back link should go: `/words` with the filter that was in force,
 * taken from the link's own history state, or from the remembered one after a
 * reload dropped it.
 */
export function listPath(state: unknown): string {
  const q = filterFromState(state) ?? read(FILTER_KEY) ?? ''
  return q === '' ? '/words' : `/words?q=${encodeURIComponent(q)}`
}

/** `window.scrollTo`, skipped when the page is already there. */
export function scrollWindowTo(y: number): void {
  if (window.scrollY === y) return
  window.scrollTo(0, y)
}
