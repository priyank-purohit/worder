import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as Highcharts from 'highcharts'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../hooks/useStore'
import { WordListProvider } from '../hooks/useWordList'
import { STORAGE_KEY } from '../lib/storage'
import type { Store } from '../lib/types'
import WordsPage from './WordsPage'

const CSV = [
  'English,French,Gujarati',
  'water,eau,પાણી',
  'already,déjà,',
  'to,à,ને',
  'to be,être,',
].join('\n')
const KEY = 'eau::water'

const seeded: Store = {
  version: 1,
  settings: { presentationLanguage: 'French', topN: 500, topShare: 0.7, themeMode: 'system' },
  stats: {
    French: {
      [KEY]: [
        { t: Date.parse('2026-01-01T10:00:00Z'), correct: false },
        { t: Date.parse('2026-01-02T10:00:00Z'), correct: true },
        { t: Date.parse('2026-01-03T10:00:00Z'), correct: true },
      ],
    },
  },
}

/** Shows the route the app is on, so navigation can be asserted. */
function LocationDisplay() {
  const { pathname, search } = useLocation()
  return <div data-testid="location">{`${pathname}${search}`}</div>
}

const at = () => screen.getByTestId('location').textContent
const tiles = () => screen.queryAllByRole('link')
const filter = () => screen.getByLabelText('Filter words')

async function renderWords(path: string) {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(CSV) }),
  )
  render(
    <MemoryRouter initialEntries={[path]}>
      <WordListProvider>
        <StoreProvider>
          <LocationDisplay />
          <Routes>
            <Route path="/words" element={<WordsPage />} />
            <Route path="/words/:key" element={<WordsPage />} />
          </Routes>
        </StoreProvider>
      </WordListProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByTestId('location')).not.toBeNull())
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/words list', () => {
  it('renders every practisable word as a link', async () => {
    await renderWords('/words')

    // Every row has French text, so all four are listed — in file order.
    await waitFor(() => expect(tiles()).toHaveLength(4))
    expect(tiles().map((link) => link.getAttribute('href'))).toEqual([
      '/words/eau%3A%3Awater',
      '/words/d%C3%A9j%C3%A0%3A%3Aalready',
      '/words/%C3%A0%3A%3Ato',
      '/words/%C3%AAtre%3A%3Ato%20be',
    ])
    // The presentation word, its translations and its rank are all on the tile.
    expect(screen.getByText('eau')).toBeInTheDocument()
    expect(screen.getByText('water / પાણી')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('counts the words, the seen ones and their accuracy', async () => {
    await renderWords('/words')

    expect(screen.getByText('4 words · 1 seen · 67% correct')).toBeInTheDocument()
  })

  it('omits the percentage when nothing has been seen', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...seeded, stats: {} }))
    await renderWords('/words')

    expect(screen.getByText('4 words · 0 seen')).toBeInTheDocument()
  })

  it('narrows the grid, ignoring diacritics', async () => {
    await renderWords('/words')
    await waitFor(() => expect(tiles()).toHaveLength(4))

    fireEvent.change(filter(), { target: { value: 'etre' } })

    await waitFor(() => expect(tiles()).toHaveLength(1))
    expect(screen.getByText('être')).toBeInTheDocument()
    expect(screen.getByText('1 word · 0 seen')).toBeInTheDocument()
  })

  it('matches any language and says when nothing matches', async () => {
    await renderWords('/words')

    fireEvent.change(filter(), { target: { value: 'પાણી' } })
    await waitFor(() => expect(tiles()).toHaveLength(1))
    expect(screen.getByText('eau')).toBeInTheDocument()

    fireEvent.change(filter(), { target: { value: 'zzz' } })
    await waitFor(() => expect(tiles()).toHaveLength(0))
    expect(screen.getByText(/No French word matches/)).toBeInTheDocument()
  })

  it('round-trips the filter through ?q=', async () => {
    await renderWords('/words?q=deja')

    // Read from the URL on arrival…
    expect(filter()).toHaveValue('deja')
    await waitFor(() => expect(tiles()).toHaveLength(1))
    expect(screen.getByText('déjà')).toBeInTheDocument()

    // …and written back to it while typing.
    fireEvent.change(filter(), { target: { value: 'eau' } })
    await waitFor(() => expect(at()).toBe('/words?q=eau'))

    fireEvent.click(screen.getByLabelText('Clear filter'))
    await waitFor(() => expect(at()).toBe('/words'))
    expect(filter()).toHaveValue('')
  })
})

describe('/words/:key detail', () => {
  it('opens when a tile is tapped and comes back to the filtered list', async () => {
    await renderWords('/words?q=eau')
    await waitFor(() => expect(tiles()).toHaveLength(1))

    fireEvent.click(screen.getByRole('link', { name: /^eau — water/ }))

    expect(at()).toBe(`/words/${encodeURIComponent(KEY)}`)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('eau')

    fireEvent.click(screen.getByRole('link', { name: 'Back to words' }))

    expect(at()).toBe('/words?q=eau')
    expect(filter()).toHaveValue('eau')
  })

  it('shows the word, its score and its history chart', async () => {
    await renderWords(`/words/${encodeURIComponent(KEY)}`)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('eau')
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('eau')
    expect(screen.getByText('French · rank #1')).toBeInTheDocument()
    expect(screen.getByText('seen 3×')).toBeInTheDocument()
    expect(screen.getByText('2 correct')).toBeInTheDocument()
    expect(screen.getByText('1 incorrect')).toBeInTheDocument()
    expect(screen.getByText('67% correct')).toBeInTheDocument()
    expect(screen.getByText('Accuracy over time')).toBeInTheDocument()
    // A column of per-period accuracy plus the cumulative line.
    await waitFor(() => expect(document.querySelectorAll('.highcharts-series').length).toBe(2))

    const chart = Highcharts.charts
      .filter((candidate): candidate is Highcharts.Chart => Boolean(candidate))
      .at(-1)
    // Three attempts a day apart: one half-day period each, labelled locally.
    const categories = chart?.xAxis[0].categories ?? []
    expect(categories).toHaveLength(3)
    for (const category of categories) {
      expect(category).toMatch(/^[A-Z][a-z]{2} \d{1,2} 2026 (AM|PM)$/)
      expect(screen.getByText(category)).toBeInTheDocument()
    }
    // Newest attempt first.
    expect(screen.getAllByText(/^attempt \d+$/).map((el) => el.textContent)).toEqual([
      'attempt 3',
      'attempt 2',
      'attempt 1',
    ])
  })

  it('shows the empty state for a word that has never been seen', async () => {
    await renderWords(`/words/${encodeURIComponent('déjà::already')}`)

    expect(screen.getByText(/Not practised yet/)).toBeInTheDocument()
    expect(screen.queryByText('Accuracy over time')).not.toBeInTheDocument()
  })

  it('warns when the key is not in the word file, and offers a way back', async () => {
    await renderWords(`/words/${encodeURIComponent('nope::nope')}`)

    expect(screen.getByRole('alert')).toHaveTextContent('No French word matches')

    fireEvent.click(screen.getByRole('link', { name: 'All words' }))
    expect(at()).toBe('/words')
  })
})
