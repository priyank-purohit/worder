# worder — SPEC

Personal vocabulary flash-card web app, deployed to GitHub Pages at
`https://priyank-purohit.github.io/worder/`. Single user, no backend, all data in
`localStorage` on the device.

## Stack (fixed — do not substitute)

- Vite + React 18 + TypeScript (strict)
- MUI v6 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`)
- Highcharts + `highcharts-react-official`
- `react-router-dom` v6 using **HashRouter** (GitHub Pages has no server rewrites)
- `papaparse` for CSV parsing
- `vitest` for unit tests
- `vite.config.ts` must set `base: '/worder/'`
- npm scripts: `dev`, `build` (tsc -b && vite build), `preview`, `typecheck`, `test`, `lint`

## Data file

`public/words.csv`. First row is the header: language names, e.g.
`English,French,Gujarati,Hindi`. Any number of columns ≥ 2; any column may be
missing. Row order matters: **the first `topN` rows (default 500) are treated as the
most common words** and are drawn more often. Cells may contain commas inside quotes
(use papaparse). Skip rows that have fewer than 2 non-empty cells. Trim cells.

The shipped file holds **1996 French lemmas** from **Lexique 3.83**
(lexique.org — New, Pallier, Brysbaert & Ferrand), ranked by film-subtitle lemma
frequency (`freqlemfilms2`), most common first — so the row order is what makes
`topN` meaningful. Elided forms and onomatopoeia are excluded, and there is one
row per lemma, so no French lemma appears twice. Glosses carry **up to two senses
joined by `" / "`** (e.g. `air / appearance`, `alone / only`) and verbs are
glossed as `"to …"` (`to be`, `to listen`). Four subtitle-corpus artifacts were
dropped from the top 2000: `to` and `com` (English text and URL fragments inside
subtitle files) and `mlle`/`mme` (written abbreviations whose spelled-out lemmas
`mademoiselle`/`madame` are already in the list). Duplicate English glosses
across different French rows are allowed — the row identity is the French lemma.

Swapping to another language = replacing this file. Nothing else changes.

### Phrase file

`public/phrases.csv`: the same shape, parsed by the same code. The shipped file
holds **200 tourist phrases** (greetings, communication, directions and
transport, accommodation, restaurant, shopping and money, emergencies and health,
time, numbers and sightseeing), most useful first, with EN/FR/GU/HI columns. It is
**optional**: when it is missing or unusable `WordListProvider` leaves
`phraseList` empty and sets `phraseError`, the Phrases tab shows that message and
nothing else in the app changes. Both files are fetched in parallel on start.

## Core types (`src/lib/types.ts`)

```ts
export interface WordRow {
  index: number;                    // 0-based row position in the file (after header)
  texts: Record<string, string>;    // language name -> text (missing/empty cells omitted)
}
export interface WordList { languages: string[]; rows: WordRow[]; }
export interface Attempt { t: number; correct: boolean; }   // t = epoch ms
export type ThemeMode = 'system' | 'light' | 'dark';
export interface Settings {
  presentationLanguage: string;     // default: "French" if present, else languages[1] ?? languages[0]
  phraseLanguage: string;           // front of phrase cards; default "English" if the phrase file has it,
                                    // else its languages[1] ?? languages[0]. Added after v1; missing reads
                                    // as '' until reconciled against the phrase file's header
  topN: number;                     // default 500
  topShare: number;                 // default 0.7  (probability a draw comes from the top-N pool)
  themeMode: ThemeMode;             // default 'system'; added after v1, missing/unknown reads as 'system'
}
/** Which set of cards an attempt belongs to. Each deck keeps its own stats. */
export type DeckId = 'words' | 'phrases';
export interface Store {
  version: 1;
  settings: Settings;
  // presentationLanguage -> wordKey -> attempts (chronological)
  stats: Record<string, Record<string, Attempt[]>>;
  // The same, for public/phrases.csv. Absent in older stores/exports = {}.
  phraseStats: Record<string, Record<string, Attempt[]>>;
}
```

`statsOf(store, deck)` picks the bucket; nothing reads `store.stats` directly for
a deck it was not given. The phrase deck's stats are keyed by `phraseLanguage`
(e.g. `phraseStats.English['Thank you::Merci']`), so English-first and
French-first practice have separate histories.

`reconcileSettings(settings, languages, phraseLanguages = languages)` repairs
`presentationLanguage` against the word file's header and `phraseLanguage`
against the phrase file's; an empty header list repairs nothing.

### Word key (`src/lib/wordKey.ts`)

Stats are kept **per presentation language**. Within a language the key for a row is
`${texts[presLang]}::${texts[other]}` where `other` is the first language in header
order that is not `presLang` and has a value for that row. This disambiguates
duplicates (e.g. French "à" appears for both "to" and "at"). Rows lacking a value in
`presLang` are excluded from practice for that language.

## Storage (`src/lib/storage.ts`)

- Single `localStorage` key `worder:v1`, JSON of `Store`.
- `loadStore()`, `saveStore()`, `recordAttempt(deck, presLang, key, correct, t = Date.now())`,
  `undoLastAttempt(deck, presLang, key)` (removes the most recent attempt),
  `resetStats()` (both decks), `exportJson(): string`, `importJson(json: string)`
  (validates shape; merges by replacing whole store), `updateSettings(partial)`.
- `parseStore` accepts a missing `phraseStats` (older data) as `{}`, keeps a
  well-formed one, and rejects a malformed one like it rejects malformed `stats`.
- Wrap all reads/writes in try/catch; app must work if storage is unavailable
  (in-memory fallback).
- Expose via a React context/hook `useStore()` so all pages re-render on change.

## Scheduler (`src/lib/scheduler.ts`)

`pickNext(rows: WordRow[], settings: DrawSettings, recentKeys: string[], rng = Math.random): WordRow`

`DrawSettings = Pick<Settings, 'presentationLanguage' | 'topN' | 'topShare'>` — only the
settings a draw depends on, so a caller does not have to hold a whole `Settings`.

- Eligible rows = rows with a value in `presentationLanguage`.
- Top pool = eligible rows with `index < topN`; rest pool = the others.
- With probability `topShare` pick uniformly from top pool, else from rest pool. If the
  chosen pool is empty, use the other.
- Avoid the last 5 shown keys when the pool has more than 5 rows.
- Pure function, unit-tested.

## Stats helpers (`src/lib/stats.ts`) — pure, unit-tested

- `summarize(attempts)` → `{ seen, correct, incorrect, pctCorrect | null }`
- `halfDayPeriods(attempts)` → one entry per **local half-day that has attempts**, oldest
  first: `{ start, label: 'MMM D YYYY AM|PM', correct, incorrect, pct, cumulativePct }`.
  A local calendar day is split at noon; `pct` is accuracy inside the period and
  `cumulativePct` is accuracy over every attempt up to the end of it.
- `accuracyByPresentation(allStats)` → for n = 1..max, `% correct on a word's n-th
  presentation` across all words, plus the sample count for each n
- `attemptsPerDay(allStats)` → `[{ day: 'YYYY-MM-DD', correct, incorrect }]`
- `hardestWords(allStats, minAttempts = 3, limit = 20)` → lowest pctCorrect first

## Pages (HashRouter)

Navigation: MUI `BottomNavigation` on small screens (`sm` down), `AppBar` with tabs
on larger. Five items, in order: Practice, Phrases, Words, Dashboard, Settings. The palette comes from `settings.themeMode`: `light` and `dark` are
explicit, `system` follows `useMediaQuery('(prefers-color-scheme: dark)')`. `App`
reads the mode inside the store provider (`ThemedApp`) and keeps the
`<meta name="theme-color">` in step with `palette.background.default`.
Everything must be usable on phone, tablet and desktop.

### `/` Practice (`src/pages/PracticePage.tsx`)

- One card centered, large presentation word. The header is a single line that never
  wraps: `#<index+1>`, then — for a word that has been seen — one small dot per
  result for the **last 10 attempts**, oldest on the left, green for correct and red
  for incorrect (`HistoryDots`, `role="img"` with an `aria-label` of
  `Last N results: correct, incorrect, …`). No percentage and no `seen N×` anywhere
  on the card.
- **Font fitting** (`useFitText`): the word is sized so its longest
  whitespace-separated token fits the card's width — measured with an offscreen
  canvas in the element's own computed font, so no layout pass and no resize loop.
  Range 20 px to 56 px on a phone (`sm` down) / 64 px above, filling 92% of the
  available width, re-measured through a `ResizeObserver`. A single-token entry gets
  `white-space: nowrap` and is therefore always on **one line**; a multi-word entry
  may wrap, but only ever at a space (`overflow-wrap: normal`, `word-break: keep-all`,
  no hyphens) — never inside a word.
- **Reveal**: a **single tap** / click on the card, or the `Space` key. A tap is a
  press released under 8 px of movement (`TAP_SLOP`) and under 500 ms (`TAP_MAX_MS`);
  anything further or slower is a drag for the rest of the gesture, whatever its
  angle. Tapping an already-revealed card does nothing. The reveal shows the texts of
  every *other* language in small text at the bottom of the card, each labelled with
  its language name. No flip animation. Word stays visible. Unrevealed, the same slot
  reads `Tap the card or press Space to reveal`.
- **Grading is locked until the card is revealed.** Before the reveal the ✗ / ✓ buttons
  are `disabled`, `ArrowLeft` / `ArrowRight` do nothing, and a drag resists (a fifth of
  the distance, capped at 12 px, no colour tint) and springs back. A refused gesture
  shows `Tap the card to reveal first` for 1.2 s in the same fixed-height slot the
  reveal panel uses, so nothing on the card moves. A tap always works — it is how the
  card is unlocked. Every new card starts unrevealed, and so locked again.
- **Swipe right = correct, swipe left = incorrect.** Pointer-event drag with the card
  following the finger, slight rotation, green/red tint that grows with distance.
  Commit when released past ~35% of card width or with enough velocity; otherwise
  spring back. Animate off-screen then load the next card. Also `ArrowRight` /
  `ArrowLeft` keys, and two large ✗ / ✓ `IconButton`s under the card for accessibility.
- Each attempt records `{ t: Date.now(), correct }` under the current presentation
  language and word key.
- **Undo** button (`UndoIcon`): removes the last recorded attempt and brings that card
  back (unrevealed). Disabled when nothing to undo. One level is enough.
- **The route is exactly one viewport tall and never scrolls.** A vertical pan or an
  overscroll bounce used to move the page under a slightly diagonal swipe and cancel
  the card's gesture. Three things together:
  - `Layout` puts `.viewport-shell` (`index.css`) on the shell for `/` only —
    `height: 100dvh` with a `100vh` fallback, `overflow: hidden` — and gives the
    `Container` `overflow: hidden`. Every other route is untouched and scrolls as
    usual.
  - `PracticePage` also sets `document.body.style.overflow = 'hidden'` while it is
    mounted and restores the previous value on unmount, so Words, Dashboard and
    Settings still scroll after a visit to Practice.
  - `html, body { overscroll-behavior: none }` (`index.css` — the only place it is
    declared) kills the rubber-band.
- Nothing may overflow that viewport, so the card is `flex: 1 1 auto; min-height: 0`
  (capped at 520 px from `sm` up) instead of a fixed `min-height`, the buttons and the
  helper line are `flex-shrink: 0`, and the helper line is `display: none` under a
  700 px viewport height — the first thing to go rather than push the card out.
- The card takes `touch-action: none`: it owns every gesture on it, which also blocks
  double-tap zoom on iOS. `pan-y` used to leave vertical pans to the browser, which
  would claim a slightly diagonal swipe mid-gesture (`pointercancel`) and lose it;
  there is no page scroll left to hand one to. Plus `user-select: none`.
- Helper line under the buttons: `Tap to reveal, then swipe right if you knew it, left
  if not`, with ` · arrow keys work too` appended from `sm` up.

### `/phrases` and `/phrases/stats` Phrases (`src/pages/PhrasesPage.tsx`)

One tab, two views, chosen by a `ToggleButtonGroup` (`aria-label="Phrases view"`,
**Practice** / **Stats**) in a header row beside an `h2` "Phrases"; the view is
the route, so either can be linked to. The card's front language is
`settings.phraseLanguage`, **not** `presentationLanguage`, in both views and on
`/words?set=phrases`; it is chosen in Settings only — the tab has no language
control of its own.

- **Practice** (`/phrases`) is the same `PracticeDeck` as `/` with
  `deck="phrases"`, dealt from `phraseList`. Every phrase is a common one, so the
  draw is uniform over the whole list: `topN = Number.MAX_SAFE_INTEGER`,
  `topShare = 1` (the whole list is the top pool). The fitted font is capped at
  **36 px** (`maxFontPx`) because a phrase wraps onto several lines. The route is
  a fixed one-viewport, non-scrolling route exactly like `/` (`Layout` gives it the
  `.viewport-shell`; `useNoDocumentScroll` pins the body while the card is shown),
  with the header row `flex-shrink: 0` and the deck taking the rest.
- **Stats** (`/phrases/stats`) scrolls normally. `PhraseStats`: `StatTiles`
  (`phrases-seen` as `seen / eligible`, `phrase-attempts`, `phrase-overall-correct`,
  `phrase-presentation-language`), attempts per day, accuracy by presentation
  number, a "Hardest phrases" table whose rows link to
  `/words/:key?set=phrases`, and a "Browse all phrases" button to
  `/words?set=phrases`. All of it reads `store.phraseStats[presLang]` only.
- Answers go to `phraseStats` through `recordAttempt('phrases', …)`; the word
  stats are never touched. The Dashboard tab stays words-only.
- No phrase has the presentation language → the same kind of info `Alert` as `/`.
  `phraseError` set → a warning `Alert` with the message; nothing is pinned.

### `/words` and `/words/:key` Word stats (`src/pages/WordsPage.tsx`)

Both routes take **`?set=phrases`** to show the phrase deck instead
(`deckFromParams`; anything else is the words deck, which is left out of URLs so
old links keep working). The list gets a **Words | Phrases** `ToggleButtonGroup`
(`aria-label="Deck"`, `DeckToggle`) in the heading row, and the `h2` reads
"Words" or "Phrases" to match. Switching keeps `?q=`. Tiles, the hardest-words
rows and the back link carry the deck (`detailPath`, `browsePath`,
`listPath(state, deck)`), the count line uses the right noun (`1 phrase · 0
seen`), the back button is `aria-label="Back to phrases"`, and the stats shown
are `statsOf(store, deck)[presLang]`.

- `/words` is a **browsable grid of every practisable word** for the current
  presentation language, in file order (= frequency rank) — not a search box. An `h2`
  "Words", a filter, a count line, then the tiles. `Layout` gives this route (and its
  detail) `Container maxWidth="lg"` rather than `md`, so a desktop fits six columns.
- **Filter** (`WordFilter`): a small `TextField` with a search icon, a clear button
  (`aria-label="Clear filter"`) and `aria-label="Filter words"`. Substring match of
  the folded input against *any* language's folded text, so `etre` finds `être` — the
  fold is precomputed once per row in `buildWordOptions`. No result cap: the whole
  match set is shown. The value lives in the URL as **`?q=`** (written with
  `replace: true`, so typing does not fill the history stack) and is read back from it,
  so the list is linkable and survives a reload. Filtering runs through
  `useDeferredValue`, so a keystroke lands in the input before thousands of tiles
  re-render.
- **Count line**: `1,996 words · 120 seen · 63% correct` (`summarizeOptions`) — over
  the *filtered* set; the percentage is omitted until something has been seen.
- **Tiles** (`WordGrid` / `WordTile`): `grid-template-columns: repeat(auto-fill,
  minmax(160px, 1fr))`, `gap: 8px` — two columns on a phone, six on a desktop. Each
  tile is a `ButtonBase` link to `/words/<encodeURIComponent(key)>` showing the
  presentation word, `#rank`, and the other languages on a second line, both
  ellipsised on one line. `aria-label` is `<word> — <others>, rank <n>`. All ~2,000
  are in the DOM at once, so the styling is declared **once** in `WordGrid` and the
  tiles only carry class names, ripples are disabled, and `content-visibility: auto`
  with `contain-intrinsic-size: 56px` lets the browser skip what is offscreen.
- **Accuracy-coloured left border** (4 px): green `#2e7d32` at **≥ 70%**, `warning.main`
  at **≥ 40%**, red `#c62828` below that, and the plain `divider` colour for a word
  with no attempts in this language.
- Tapping a tile navigates to the detail route, remembering the filter and the scroll
  offset (`listMemory`, `sessionStorage`, every access guarded); the link also carries
  `state={{ q }}`. Detail opens scrolled to the top.
- `/words/:key` is the **detail page**, not a panel under the list: a back
  `IconButton` (`aria-label="Back to words"`) beside the word as an `h2`, then all
  texts by language, rank `#index+1`, seen / correct / incorrect / % correct chips.
  Empty state if never seen. Back goes to `/words?q=<the filter that was in force>`
  and the list resumes at the offset it was left at. An unknown key gets a warning
  `Alert` with an "All words" button back to the list.
- Highcharts chart, "Accuracy over time": x = **category axis of half-day periods**
  from `halfDayPeriods`, labelled `MMM D YYYY AM|PM` (e.g. `Sep 2 2026 PM`), tilted 45°
  past 6 categories. Two series on the **one** 0–100 % y axis: a green
  (`#2e7d32`) **column** of the accuracy inside each period, data-labelled with its
  score as `k/n`, and a dashed grey **line** of the cumulative accuracy up to the end
  of each period. Shared tooltip: period, `k of n correct`, cumulative %.
- Below: compact table/list of attempts (date, result), newest first.

### `/dashboard` (`src/pages/DashboardPage.tsx`)

- Stat tiles (`StatTiles`): words seen / total eligible, total attempts, overall %
  correct, current presentation language — counts with thousands separators. A plain
  **CSS grid** (`repeat(2, minmax(0, 1fr))`, four columns from `md`, `gap: 12px`), not
  MUI `Grid`: `Grid container spacing` pads its items and cancels that with a negative
  margin on the row, and the `Stack` on this page resets item margins
  (`& > :not(style):not(style) { margin: 0 }`), which won on specificity — the row kept
  `width: calc(100% + 16px)` and lost `margin-left: -16px`, so it sat 16 px right of
  the section headings and overhung the right gutter. `minmax(0, 1fr)` plus
  `min-width: 0` on the tile, a single-line `clamp(1.25rem, 6vw, 2rem)` value and an
  ellipsised caption keep all four tiles exactly the same width and height. Each tile
  has `data-testid="tile-<id>"` from its own stable `id`.
- Chart A, "Accuracy by presentation number": green columns of `accuracyByPresentation`
  on a single 0–100 % y axis; tooltip spells out the ordinal and the sample count `n`.
- Chart B, "Words reaching each presentation number": the sample size behind chart A as
  neutral-grey columns on its own count axis, sharing chart A's ordinal categories.
  Two separate charts, each with **one** y axis — the counts used to be a second series
  on a second axis of chart A, which made neither readable.
- Chart C: attempts per day, stacked columns green/red.
- Table: hardest words (`hardestWords`), each row links to `/words/:key`.

### `/settings` (`src/pages/SettingsPage.tsx`)

- Appearance: a `ToggleButtonGroup` of **System / Light / Dark** writing
  `settings.themeMode`, with the helper text "System follows your device setting."
- Presentation language `Select` (from the word file's header languages).
- Phrase language `Select` (from the phrase file's header languages; hidden when
  the phrase file did not load). The only place the phrase language is set.
- `topN` number field, `topShare` slider (0–1, step 0.05, shown as %).
- Word file info: detected languages, row count; a line for the phrase file
  (`data-testid="phrase-file-summary"`) or a warning with `phraseError`
  (`data-testid="phrase-file-error"`).
- Export stats (downloads `worder-stats-<date>.json`), Import stats (file picker,
  confirm dialog), Reset all stats (confirm dialog). The attempt count and the
  reset cover both decks.

## Deploy

`.github/workflows/deploy.yml`: on push to `main`, `actions/checkout@v4`,
`actions/setup-node@v4` (node 22, cache npm), `npm ci`, `npm run build`,
`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` (path `dist`),
`actions/deploy-pages@v4`. Permissions `pages: write`, `id-token: write`.

## Conventions

- `src/lib/*` = pure logic, no React. `src/components/*` = shared UI.
  `src/pages/*` = routes. `src/hooks/*` = React hooks.
- No `any`. Strict TS. Keep components small. No unused deps.
- Colours: correct `#2e7d32`, incorrect `#c62828`.
