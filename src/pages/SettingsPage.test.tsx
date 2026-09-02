import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider, useStore } from '../hooks/useStore'
import { WordListProvider } from '../hooks/useWordList'
import { STORAGE_KEY } from '../lib/storage'
import type { Store } from '../lib/types'
import SettingsPage from './SettingsPage'

const CSV = ['English,French,Gujarati', 'a,un,એક', 'able,capable,સમર્થ', 'about,environ,વિશે'].join(
  '\n',
)

/** Surfaces the live store so assertions do not depend on the UI. */
function Probe() {
  const { store } = useStore()
  const attempts = Object.values(store.stats).reduce(
    (total, byKey) =>
      total + Object.values(byKey).reduce((sum, list) => sum + list.length, 0),
    0,
  )
  return (
    <>
      <span data-testid="pres-lang">{store.settings.presentationLanguage}</span>
      <span data-testid="attempts">{attempts}</span>
    </>
  )
}

async function renderPage() {
  render(
    <WordListProvider>
      <StoreProvider>
        <Probe />
        <SettingsPage />
      </StoreProvider>
    </WordListProvider>,
  )
  // The word list loads asynchronously; the page only mounts afterwards.
  await screen.findByRole('heading', { name: 'Practice' })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(CSV, { status: 200 }))),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsPage', () => {
  it('shows the word file summary', async () => {
    await renderPage()

    expect(screen.getByTestId('pres-lang')).toHaveTextContent('French')
    expect(screen.getByText('3 rows in total')).toBeInTheDocument()
    expect(screen.getByText(/3 rows have a French word/)).toBeInTheDocument()
    expect(screen.getByText(STORAGE_KEY)).toBeInTheDocument()
  })

  it('changes the presentation language', async () => {
    await renderPage()

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Presentation language' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Gujarati' }))

    await waitFor(() => {
      expect(screen.getByTestId('pres-lang')).toHaveTextContent('Gujarati')
    })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Store
    expect(stored.settings.presentationLanguage).toBe('Gujarati')
  })

  it('commits topN on blur and rejects out-of-range values', async () => {
    await renderPage()
    const field = screen.getByLabelText('Common words (top N)')

    fireEvent.change(field, { target: { value: '2' } })
    fireEvent.blur(field)
    await waitFor(() => {
      expect(screen.getByText(/of cards come from the top 2,/)).toBeInTheDocument()
    })

    fireEvent.change(field, { target: { value: '99' } })
    expect(screen.getByText(/Enter a whole number from 1 to 3\./)).toBeInTheDocument()
    fireEvent.blur(field)
    await waitFor(() => {
      expect(field).toHaveValue(2)
    })
  })

  it('resets stats through the confirm dialog', async () => {
    const seeded: Store = {
      version: 1,
      settings: { presentationLanguage: 'French', topN: 2, topShare: 0.7 },
      stats: { French: { 'un::a': [{ t: 1, correct: true }] } },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    await renderPage()
    expect(screen.getByTestId('attempts')).toHaveTextContent('1')

    fireEvent.click(screen.getByRole('button', { name: /Reset all stats/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('This permanently deletes every attempt recorded')

    fireEvent.click(screen.getByRole('button', { name: 'Clear stats' }))

    await waitFor(() => {
      expect(screen.getByTestId('attempts')).toHaveTextContent('0')
    })
    expect(await screen.findByText('Stats cleared')).toBeInTheDocument()
  })

  it('imports a file after confirming, and reports a bad file', async () => {
    await renderPage()
    const input = screen.getByTestId('import-file-input')

    const imported: Store = {
      version: 1,
      settings: { presentationLanguage: 'Gujarati', topN: 3, topShare: 0.5 },
      stats: { Gujarati: { 'એક::a': [{ t: 1, correct: true }, { t: 2, correct: false }] } },
    }
    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(imported)], 'worder-stats.json')] },
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByTestId('attempts')).toHaveTextContent('2')
    })
    expect(screen.getByTestId('pres-lang')).toHaveTextContent('Gujarati')
    // Wait for the dialog to leave before opening it again for the bad file.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    fireEvent.change(input, { target: { files: [new File(['not json'], 'oops.json')] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }))
    expect(await screen.findByText('That file is not valid JSON.')).toBeInTheDocument()
  })
})
