import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../hooks/useStore'
import { WordListProvider } from '../hooks/useWordList'
import { STORAGE_KEY, loadStore, recordAttempt } from '../lib/storage'
import PhrasesPage from './PhrasesPage'

const WORDS_CSV = ['English,French,Gujarati', 'water,eau,પાણી'].join('\n')
const PHRASES_CSV = ['English,French,Gujarati', 'Thank you,Merci,આભાર'].join('\n')
/** English on the front by default, so the key is English-first. */
const KEY = 'Thank you::Merci'

/** Serves each file its own CSV, so the page can be seen to pick the right one. */
function stubFetch(phrases: string | null = PHRASES_CSV) {
  vi.stubGlobal('fetch', (url: string) => {
    if (url.endsWith('phrases.csv')) {
      return phrases === null
        ? Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })
        : Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(phrases) })
    }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(WORDS_CSV) })
  })
}

function LocationDisplay() {
  const { pathname } = useLocation()
  return <div data-testid="location">{pathname}</div>
}

async function renderPhrases(path = '/phrases') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <WordListProvider>
        <StoreProvider>
          <LocationDisplay />
          <Routes>
            <Route path="/phrases" element={<PhrasesPage />} />
            <Route path="/phrases/stats" element={<PhrasesPage />} />
          </Routes>
        </StoreProvider>
      </WordListProvider>
    </MemoryRouter>,
  )
  await screen.findByTestId('location')
}

function reveal() {
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
}

beforeEach(() => {
  localStorage.clear()
  document.body.style.overflow = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/phrases practice view', () => {
  it('deals a card from the phrase file, English side up, not the word file', async () => {
    stubFetch()
    await renderPhrases()

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Phrases')
    expect(screen.getByTestId('practice-card')).toBeInTheDocument()
    expect(screen.getByTestId('practice-word')).toHaveTextContent('Thank you')
    expect(screen.queryByText('Merci')).not.toBeInTheDocument()
    expect(screen.queryByText('water')).not.toBeInTheDocument()
    expect(loadStore().settings.phraseLanguage).toBe('English')
    expect(loadStore().settings.presentationLanguage).toBe('French')

    reveal()
    const panel = screen.getByTestId('reveal-panel')
    expect(panel).toHaveTextContent('French')
    expect(panel).toHaveTextContent('Merci')
    expect(panel).toHaveTextContent('આભાર')
    // A card deck: the document is pinned so a swipe cannot scroll it.
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('records answers under phraseStats and leaves the word stats alone', async () => {
    stubFetch()
    await renderPhrases()
    reveal()
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    await waitFor(() => expect(loadStore().phraseStats.English?.[KEY]).toHaveLength(1))
    expect(loadStore().phraseStats.English[KEY][0].correct).toBe(true)
    expect(loadStore().stats).toEqual({})
  })

  it('follows the phrase language from Settings, with its own stats', async () => {
    recordAttempt('phrases', 'English', KEY, true, 1_000)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loadStore(), settings: { ...loadStore().settings, phraseLanguage: 'French' } }),
    )
    stubFetch()
    await renderPhrases()

    expect(screen.getByTestId('practice-word')).toHaveTextContent('Merci')
    // The word deck's language is untouched, and French-first phrases start
    // from a clean history of their own.
    expect(loadStore().settings.presentationLanguage).toBe('French')
    expect(screen.queryByTestId('history-dots')).not.toBeInTheDocument()
    // No language control on the tab itself: that lives in Settings.
    expect(screen.queryByRole('button', { name: /Phrase language/ })).not.toBeInTheDocument()

    reveal()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() =>
      expect(loadStore().phraseStats.French?.['Merci::Thank you']).toHaveLength(1),
    )
    expect(loadStore().phraseStats.English[KEY]).toHaveLength(1)
  })

  it('shows the phrase history dots from the phrase bucket only', async () => {
    recordAttempt('phrases', 'English', KEY, false, 1_000)
    recordAttempt('words', 'English', KEY, true, 2_000)
    recordAttempt('words', 'English', KEY, true, 3_000)
    stubFetch()
    await renderPhrases()

    expect(screen.getByTestId('history-dots')).toHaveAttribute(
      'aria-label',
      'Last 1 results: incorrect',
    )
  })

  it('explains when the phrase file is unavailable, without breaking the app', async () => {
    stubFetch(null)
    await renderPhrases()

    expect(screen.getByRole('alert')).toHaveTextContent('Phrases are unavailable')
    expect(screen.queryByTestId('practice-card')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('/phrases/stats view', () => {
  it('switches views through the toggle and the URL', async () => {
    recordAttempt('phrases', 'English', KEY, true, Date.parse('2026-03-01T09:00:00Z'))
    stubFetch()
    await renderPhrases()

    fireEvent.click(screen.getByRole('button', { name: 'Stats' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/phrases/stats'))
    expect(screen.getByTestId('phrase-stats')).toBeInTheDocument()
    expect(screen.getByTestId('tile-phrases-seen')).toHaveTextContent('1 / 1')
    expect(screen.getByTestId('tile-phrase-attempts')).toHaveTextContent('1')
    expect(screen.getByTestId('tile-phrase-overall-correct')).toHaveTextContent('100%')
    expect(screen.getByTestId('tile-phrase-presentation-language')).toHaveTextContent('English')
    expect(screen.getByText('Hardest phrases')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse all phrases' })).toHaveAttribute(
      'href',
      '/words?set=phrases',
    )
    // A scrolling page again.
    expect(document.body.style.overflow).toBe('')
    expect(screen.queryByTestId('practice-card')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/phrases$/))
    expect(screen.getByTestId('practice-card')).toBeInTheDocument()
  })

  it('counts only phrase attempts', async () => {
    recordAttempt('words', 'French', 'eau::water', true, 1_000)
    stubFetch()
    await renderPhrases('/phrases/stats')

    expect(screen.getByTestId('tile-phrases-seen')).toHaveTextContent('0 / 1')
    expect(screen.getByTestId('tile-phrase-attempts')).toHaveTextContent('0')
    expect(screen.getByTestId('tile-phrase-overall-correct')).toHaveTextContent('—')
  })
})
