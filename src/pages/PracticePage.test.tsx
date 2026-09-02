import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../hooks/useStore'
import { WordListProvider } from '../hooks/useWordList'
import { loadStore } from '../lib/storage'
import PracticePage from './PracticePage'

const CSV = ['English,French,Gujarati', 'water,eau,પાણી'].join('\n')
/** French is the default presentation language, so `eau` is the only card. */
const KEY = 'eau::water'

function stubFetch(csv: string) {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(csv) }),
  )
}

async function renderPractice(csv = CSV) {
  stubFetch(csv)
  render(
    <MemoryRouter>
      <WordListProvider>
        <StoreProvider>
          <PracticePage />
        </StoreProvider>
      </WordListProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByTestId('practice-card')).not.toBeNull())
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PracticePage', () => {
  it('shows the presentation word and its rank, hiding the other languages', async () => {
    await renderPractice()
    expect(screen.getByText('eau')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.queryByText('water')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()
  })

  it('reveals every other language on Space', async () => {
    await renderPractice()
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })

    const panel = screen.getByTestId('reveal-panel')
    expect(panel).toHaveTextContent('English')
    expect(panel).toHaveTextContent('water')
    expect(panel).toHaveTextContent('Gujarati')
    expect(panel).toHaveTextContent('પાણી')
    // No flip: the presentation word stays visible.
    expect(screen.getByText('eau')).toBeInTheDocument()
  })

  it('reveals on a double tap of the card', async () => {
    await renderPractice()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card)
    fireEvent.pointerUp(card)
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()

    fireEvent.pointerDown(card)
    fireEvent.pointerUp(card)
    expect(screen.getByTestId('reveal-panel')).toBeInTheDocument()
  })

  it('commits a correct attempt when dragged right past the threshold', async () => {
    await renderPractice()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 180, clientY: 205 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 300, clientY: 210 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 300, clientY: 210 })

    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    expect(loadStore().stats.French[KEY][0].correct).toBe(true)
  })

  it('springs back and records nothing when the drag is too short and slow', async () => {
    let clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    await renderPractice()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    clock = 1100
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 180, clientY: 200 })
    clock = 1200
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 170, clientY: 200 })
    clock = 1210
    // 30 px in 200 ms: neither far enough nor fast enough.
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 170, clientY: 200 })

    await new Promise((resolve) => {
      setTimeout(resolve, 350)
    })
    expect(loadStore().stats.French).toBeUndefined()
    expect(screen.getByText('eau')).toBeInTheDocument()
  })

  it('commits a fast flick that never reaches the distance threshold', async () => {
    // Real pointermove events are milliseconds apart; jsdom fires them instantly.
    let clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    await renderPractice()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    clock = 1010
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 170, clientY: 200 })
    clock = 1020
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 140, clientY: 200 })
    clock = 1025
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 140, clientY: 200 })
    // 60 px in 20 ms is a flick, even though 60 px is under the threshold.

    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    expect(loadStore().stats.French[KEY][0].correct).toBe(false)
  })

  it('records a correct attempt on ArrowRight and an incorrect one on ArrowLeft', async () => {
    await renderPractice()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    expect(loadStore().stats.French[KEY][0].correct).toBe(true)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(2))
    expect(loadStore().stats.French[KEY][1].correct).toBe(false)
  })

  it('records an attempt from the check button and shows the running summary', async () => {
    await renderPractice()

    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    expect(await screen.findByText('#1 · seen 1× · 100% correct')).toBeInTheDocument()
  })

  it('undoes the last attempt and brings the card back unrevealed', async () => {
    await renderPractice()
    const undo = screen.getByRole('button', { name: 'Undo last answer' })
    expect(undo).toBeDisabled()

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    await waitFor(() => expect(undo).toBeEnabled())

    fireEvent.click(undo)
    expect(loadStore().stats.French?.[KEY]).toBeUndefined()
    expect(screen.getByText('eau')).toBeInTheDocument()
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()
    expect(undo).toBeDisabled()
  })

  it('explains what to do when no row has the presentation language', async () => {
    stubFetch(['English,French,Gujarati', 'water,,પાણી'].join('\n'))
    render(
      <MemoryRouter>
        <WordListProvider>
          <StoreProvider>
            <PracticePage />
          </StoreProvider>
        </WordListProvider>
      </MemoryRouter>,
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('French')
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })
})
