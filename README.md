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
- The shipped file has **1996 French lemmas, sorted by film-subtitle lemma
  frequency** — `freqlemfilms2` from **Lexique 3.83** (<http://www.lexique.org>;
  New, Pallier, Brysbaert & Ferrand), most common first. Elided forms and
  onomatopoeia are excluded and there is one row per lemma, so no French lemma
  appears twice. Each gloss gives up to two senses joined by `" / "` —
  `air / appearance`, `alone / only` — and verbs are glossed as `"to …"`
  (`to be`, `to listen`). Four subtitle-corpus artifacts were dropped: `to` and
  `com`, which are English text and URL fragments from inside subtitle files,
  and the written abbreviations `mlle` and `mme`, whose spelled-out lemmas
  `mademoiselle` and `madame` are already in the list. The same English gloss may
  appear on more than one French row; the French lemma is what identifies a row.
- Lexique is distributed under the **Creative Commons Attribution – ShareAlike
  4.0** licence (CC BY-SA 4.0), so the frequency ranking here is reused with
  attribution to New, B., Pallier, C., Brysbaert, M. & Ferrand, L., *Lexique 2:
  A New French Lexical Database*, Behavior Research Methods, Instruments, &
  Computers 36(3), 516–524 (2004).
- The previous list — 968 rows in English-frequency order — is kept at
  `data/words-english-968.csv`; copy it over `public/words.csv` to go back.

### Swapping in another language

Replace `public/words.csv` with a file in the same shape and nothing else
changes — the language menu, the practice card and every chart are driven by the
header row. Pick the presentation language in Settings (it defaults to `French`
if that column exists, otherwise the second column).

Statistics are stored per presentation language, keyed by
`<presentation text>::<first other translation>`, so swapping the file keeps the
history of any word whose pair is unchanged, and homographs (French `à` for both
"to" and "at") stay separate.

If the stored presentation language is not in the new header row, it falls back
to the default for the file (`French` if present, else the second column) and
that repair is saved straight away — the rest of the store, including stats
recorded under the old language, is left untouched.

## Practising

One card at a time. Reveal the other languages with a double tap (or a
double-click, or `Space`); the presentation word stays visible. Answer by
swiping the card **right for correct, left for incorrect**, with the ✗ / ✓
buttons under it, or with `ArrowLeft` / `ArrowRight`. **Grading is locked until
you reveal**: before that the ✗ / ✓ buttons are disabled, the arrow keys do
nothing and a swipe resists and springs back with a "Reveal the translation
first" nudge, so a card can never be scored before you have seen the answer.
**Undo** takes back the last answer and brings that card back unrevealed.

The header of the card shows the word's rank plus a dot per result for its last
ten attempts — green for correct, red for incorrect — and the word itself is
sized to fit, so a single word is always on one line.

The card sets `touch-action: pan-y`: the page still scrolls vertically, a double
tap does not zoom, and — unlike `manipulation` — the browser does not steal the
horizontal drag, which would otherwise cancel the swipe mid-gesture.

Charts read in the browser's own time zone (set once in
`src/lib/highchartsSetup.ts`), and attempts are bucketed by local calendar day,
so a late-evening session lands on the day it happened.

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

Settings also has an **Appearance** picker — **System** (follow the device's
light/dark setting), **Light** or **Dark** — remembered with the rest of your
settings.
