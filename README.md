# worder

A personal vocabulary flash-card web app. Single user, no backend: the word list
is a static CSV and every statistic lives in `localStorage` on the device you
practise on. Deployed to GitHub Pages at
<https://priyank-purohit.github.io/worder/>.

Stack: Vite, React 18, TypeScript (strict), MUI, Highcharts, React Router
(HashRouter, because GitHub Pages has no server rewrites), papaparse, vitest.

## Running it

```sh
npm install
npm run dev        # dev server
npm run build      # tsc -b && vite build, output in dist/
npm run preview    # serve the production build
npm run typecheck  # tsc -b --noEmit
npm test           # vitest run
npm run lint       # oxlint
```

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`.

## The word list

`public/words.csv` is the whole data layer.

- The first row is the header and holds the language names, e.g.
  `English,French,Gujarati,Hindi`. Any number of columns ≥ 2.
- Every following row is one word, one cell per language. Cells are trimmed;
  empty cells mean "no translation". Rows with fewer than two non-empty cells
  are skipped. Commas inside a cell must be quoted (`"hello, there"`).
- **Row order is frequency order.** The first `topN` rows (default 500) are
  treated as the most common words, and a draw comes from that pool with
  probability `topShare` (default 0.7) — so roughly 70% of cards come from the
  top 500 and 30% from the long tail. Both are adjustable in Settings.

### Swapping in another language

Replace `public/words.csv` with a file in the same shape and nothing else
changes — the language menu, the practice card and every chart are driven by the
header row. Pick the presentation language in Settings (it defaults to `French`
if that column exists, otherwise the second column).

Statistics are stored per presentation language, keyed by
`<presentation text>::<first other translation>`, so swapping the file keeps the
history of any word whose pair is unchanged, and homographs (French `à` for both
"to" and "at") stay separate.

## Statistics, export and import

Everything is written to a single `localStorage` key, `worder:v1`, as JSON.
That means:

- Stats are **per device and per browser**. There is no account and nothing is
  uploaded anywhere.
- Clearing site data, or using a private window, loses them. If the browser
  blocks storage entirely the app still runs, but only remembers the current
  session.

Settings has **Export stats** (downloads `worder-stats-<date>.json`), **Import
stats** (replaces everything in the file after a confirmation) and **Reset all
stats** (keeps your settings, drops every attempt). Export before switching
devices or clearing your browser.
