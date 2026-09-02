import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../hooks/useStore'
import { WordListProvider } from '../hooks/useWordList'
import { STORAGE_KEY } from '../lib/storage'
import type { Store } from '../lib/types'
import WordsPage from './WordsPage'

const CSV = ['English,French,Gujarati', 'water,eau,પાણી', 'already,déjà,', 'to,à,ને'].join('\n')
const KEY = 'eau::water'

const seeded: Store = {
  version: 1,
  settings: { presentationLanguage: 'French', topN: 500, topShare: 0.7 },
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

async function renderWords(path: string) {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(CSV) }),
  )
  render(
    <MemoryRouter initialEntries={[path]}>
      <WordListProvider>
        <StoreProvider>
          <Routes>
            <Route path="/words" element={<WordsPage />} />
            <Route path="/words/:key" element={<WordsPage />} />
          </Routes>
        </StoreProvider>
      </WordListProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByLabelText('Search words')).not.toBeNull())
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WordsPage', () => {
  it('lists the practisable words for the presentation language', async () => {
    await renderWords('/words')
    // "déjà" and "eau" and "à" all have French text; every row here does.
    expect(screen.getByText(/3 French words/)).toBeInTheDocument()
  })

  it('finds a word by another language and shows its detail', async () => {
    await renderWords('/words')
    fireEvent.change(screen.getByLabelText('Search words'), { target: { value: 'wat' } })
    fireEvent.click(await screen.findByRole('option', { name: /eau water/ }))

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('eau')
    expect(screen.getByText('French · rank #1')).toBeInTheDocument()
  })

  it('matches ignoring diacritics', async () => {
    await renderWords('/words')
    fireEvent.change(screen.getByLabelText('Search words'), { target: { value: 'DEJA' } })
    expect(await screen.findByRole('option', { name: /deja|déjà/ })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('pre-selects the word in the path and renders its history', async () => {
    await renderWords(`/words/${encodeURIComponent(KEY)}`)

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('eau')
    expect(screen.getByText('seen 3×')).toBeInTheDocument()
    expect(screen.getByText('2 correct')).toBeInTheDocument()
    expect(screen.getByText('1 incorrect')).toBeInTheDocument()
    expect(screen.getByText('67% correct')).toBeInTheDocument()
    expect(screen.getByText('Accuracy over time')).toBeInTheDocument()
    await waitFor(() =>
      expect(document.querySelectorAll('.highcharts-series').length).toBe(2),
    )
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

  it('warns when the key is not in the word file', async () => {
    await renderWords(`/words/${encodeURIComponent('nope::nope')}`)

    expect(screen.getByRole('alert')).toHaveTextContent('No French word matches')
  })
})
