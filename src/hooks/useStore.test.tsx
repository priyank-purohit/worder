import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, defaultSettings } from '../lib/storage'
import type { Store } from '../lib/types'
import { StoreProvider, useStore } from './useStore'
import { WordListProvider } from './useWordList'

const CSV = ['English,French,Gujarati', 'water,eau,પાણી'].join('\n')
const LANGUAGES = ['English', 'French', 'Gujarati']

/** The store as it sits in localStorage right now. */
function stored(): Store | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === null ? null : (JSON.parse(raw) as Store)
}

/** Shows the live presentation language and drives one mutation. */
function Probe() {
  const { store, recordAttempt, updateSettings } = useStore()
  return (
    <>
      <span data-testid="pres-lang">{store.settings.presentationLanguage}</span>
      <button type="button" onClick={() => recordAttempt('French', 'eau::water', true, 1000)}>
        answer
      </button>
      <button type="button" onClick={() => updateSettings({ topN: 7 })}>
        set topN
      </button>
    </>
  )
}

async function renderProvider() {
  render(
    <WordListProvider>
      <StoreProvider>
        <Probe />
      </StoreProvider>
    </WordListProvider>,
  )
  await screen.findByTestId('pres-lang')
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

describe('StoreProvider on a fresh device', () => {
  it('persists the resolved defaults on mount', async () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    await renderProvider()

    expect(screen.getByTestId('pres-lang')).toHaveTextContent('French')
    await waitFor(() => expect(stored()).not.toBeNull())
    expect(stored()?.settings).toEqual(defaultSettings(LANGUAGES))
  })

  it('records the first attempt under the real presentation language', async () => {
    await renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'answer' }))

    await waitFor(() => expect(stored()?.stats.French?.['eau::water']).toHaveLength(1))
    const settings = stored()?.settings
    expect(settings?.presentationLanguage).toBe('French')
    // The old bug: a mutator re-read storage with no languages and wrote ''.
    expect(Object.keys(stored()?.stats ?? {})).toEqual(['French'])
  })

  it('keeps settings and stats together across mutations', async () => {
    await renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'answer' }))
    fireEvent.click(screen.getByRole('button', { name: 'set topN' }))

    await waitFor(() => expect(stored()?.settings.topN).toBe(7))
    expect(stored()?.settings.presentationLanguage).toBe('French')
    expect(stored()?.stats.French?.['eau::water']).toHaveLength(1)
  })
})

describe('StoreProvider with a stored language the word file lost', () => {
  it('falls back to the default for the file and persists the repair', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { presentationLanguage: 'Klingon', topN: 12, topShare: 0.4 },
        stats: { Klingon: { 'a::b': [{ t: 1, correct: true }] } },
      }),
    )
    await renderProvider()

    expect(screen.getByTestId('pres-lang')).toHaveTextContent('French')
    await waitFor(() => expect(stored()?.settings.presentationLanguage).toBe('French'))
    // Only the language is repaired: the rest of the store survives.
    expect(stored()?.settings.topN).toBe(12)
    expect(stored()?.stats.Klingon?.['a::b']).toHaveLength(1)
  })
})
