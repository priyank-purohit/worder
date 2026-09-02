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

Swapping to another language = replacing this file. Nothing else changes.

## Core types (`src/lib/types.ts`)

```ts
export interface WordRow {
  index: number;                    // 0-based row position in the file (after header)
  texts: Record<string, string>;    // language name -> text (missing/empty cells omitted)
}
export interface WordList { languages: string[]; rows: WordRow[]; }
export interface Attempt { t: number; correct: boolean; }   // t = epoch ms
export interface Settings {
  presentationLanguage: string;     // default: "French" if present, else languages[1] ?? languages[0]
  topN: number;                     // default 500
  topShare: number;                 // default 0.7  (probability a draw comes from the top-N pool)
}
export interface Store {
  version: 1;
  settings: Settings;
  // presentationLanguage -> wordKey -> attempts (chronological)
  stats: Record<string, Record<string, Attempt[]>>;
}
```

### Word key (`src/lib/wordKey.ts`)

Stats are kept **per presentation language**. Within a language the key for a row is
`${texts[presLang]}::${texts[other]}` where `other` is the first language in header
order that is not `presLang` and has a value for that row. This disambiguates
duplicates (e.g. French "à" appears for both "to" and "at"). Rows lacking a value in
`presLang` are excluded from practice for that language.

## Storage (`src/lib/storage.ts`)

- Single `localStorage` key `worder:v1`, JSON of `Store`.
- `loadStore()`, `saveStore()`, `recordAttempt(presLang, key, correct, t = Date.now())`,
  `undoLastAttempt(presLang, key)` (removes the most recent attempt), `resetStats()`,
  `exportJson(): string`, `importJson(json: string)` (validates shape; merges by
  replacing whole store), `updateSettings(partial)`.
- Wrap all reads/writes in try/catch; app must work if storage is unavailable
  (in-memory fallback).
- Expose via a React context/hook `useStore()` so all pages re-render on change.

## Scheduler (`src/lib/scheduler.ts`)

`pickNext(rows: WordRow[], settings, recentKeys: string[], rng = Math.random): WordRow`

- Eligible rows = rows with a value in `presentationLanguage`.
- Top pool = eligible rows with `index < topN`; rest pool = the others.
- With probability `topShare` pick uniformly from top pool, else from rest pool. If the
  chosen pool is empty, use the other.
- Avoid the last 5 shown keys when the pool has more than 5 rows.
- Pure function, unit-tested.

## Stats helpers (`src/lib/stats.ts`) — pure, unit-tested

- `summarize(attempts)` → `{ seen, correct, incorrect, pctCorrect | null }`
- `runningAccuracy(attempts)` → `[{ t, correct, pct }]` cumulative % after each attempt
- `accuracyByPresentation(allStats)` → for n = 1..max, `% correct on a word's n-th
  presentation` across all words, plus the sample count for each n
- `attemptsPerDay(allStats)` → `[{ day: 'YYYY-MM-DD', correct, incorrect }]`
- `hardestWords(allStats, minAttempts = 3, limit = 20)` → lowest pctCorrect first

## Pages (HashRouter)

Navigation: MUI `BottomNavigation` on small screens (`sm` down), `AppBar` with tabs
on larger. Theme follows system light/dark via `useMediaQuery('(prefers-color-scheme: dark)')`.
Everything must be usable on phone, tablet and desktop.

### `/` Practice (`src/pages/PracticePage.tsx`)

- One card centered, large presentation word. Small caption: `#<index+1>` and, if
  seen before, `seen N× · P% correct`.
- **Reveal**: double-tap / double-click on the card, or `Space` key. Shows the texts of
  every *other* language in small text at the bottom of the card, each labelled with
  its language name. No flip animation. Word stays visible.
- **Swipe right = correct, swipe left = incorrect.** Pointer-event drag with the card
  following the finger, slight rotation, green/red tint that grows with distance.
  Commit when released past ~35% of card width or with enough velocity; otherwise
  spring back. Animate off-screen then load the next card. Also `ArrowRight` /
  `ArrowLeft` keys, and two large ✗ / ✓ `IconButton`s under the card for accessibility.
- Swiping without revealing still records the attempt.
- Each attempt records `{ t: Date.now(), correct }` under the current presentation
  language and word key.
- **Undo** button (`UndoIcon`): removes the last recorded attempt and brings that card
  back (unrevealed). Disabled when nothing to undo. One level is enough.
- Double-tap must not zoom the page on iOS: `touch-action: manipulation` on the card
  and `user-select: none`.

### `/words` and `/words/:key` Word stats (`src/pages/WordsPage.tsx`)

- MUI `Autocomplete` over all rows for the current presentation language, matching
  any language's text (case/diacritic-insensitive). Option label:
  `<presWord> — <other texts joined by " / ">`.
- Selecting navigates to `/words/<encodeURIComponent(key)>`.
- Detail: all texts by language, rank `#index+1`, seen / correct / incorrect /
  % correct chips. Empty state if never seen.
- Highcharts chart: x = datetime, a **scatter** series of one dot per attempt at
  y = running accuracy % after that attempt, colour green (`#2e7d32`) for correct, red
  (`#c62828`) for incorrect, plus a thin **line** series of the same running accuracy.
  Y axis 0–100. Tooltip shows date/time and result.
- Below: compact table/list of attempts (date, result), newest first.

### `/dashboard` (`src/pages/DashboardPage.tsx`)

- Stat tiles: words seen / total eligible, total attempts, overall % correct, current
  presentation language.
- Chart A: **accuracy vs presentation number** — column or line of
  `accuracyByPresentation`; tooltip shows sample count `n`.
- Chart B: attempts per day, stacked columns green/red.
- Table: hardest words (`hardestWords`), each row links to `/words/:key`.

### `/settings` (`src/pages/SettingsPage.tsx`)

- Presentation language `Select` (from header languages).
- `topN` number field, `topShare` slider (0–1, step 0.05, shown as %).
- Word file info: detected languages, row count.
- Export stats (downloads `worder-stats-<date>.json`), Import stats (file picker,
  confirm dialog), Reset all stats (confirm dialog).

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
