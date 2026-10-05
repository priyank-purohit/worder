import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../hooks/useStore'
import { WordListProvider } from '../hooks/useWordList'
import { loadStore, recordAttempt } from '../lib/storage'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../theme'
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
  const view = render(
    <MemoryRouter>
      <WordListProvider>
        <StoreProvider>
          <PracticePage />
        </StoreProvider>
      </WordListProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByTestId('practice-card')).not.toBeNull())
  return view
}

/** Show the answer, which is what unlocks grading. */
function reveal() {
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
}

/** Put a history on `eau` before the page mounts. */
function seedAttempts(results: boolean[]) {
  results.forEach((correct, i) => {
    recordAttempt('words', 'French', KEY, correct, 1_700_000_000_000 + i * 1_000)
  })
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

beforeEach(() => {
  localStorage.clear()
  document.body.style.overflow = ''
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
    // A first-time word has no results to show, and no percentage anywhere.
    expect(screen.queryByTestId('history-dots')).not.toBeInTheDocument()
    expect(screen.queryByText(/% correct/)).not.toBeInTheDocument()
    expect(screen.queryByText('water')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()
  })

  it('reveals every other language on Space', async () => {
    await renderPractice()
    reveal()

    const panel = screen.getByTestId('reveal-panel')
    expect(panel).toHaveTextContent('English')
    expect(panel).toHaveTextContent('water')
    expect(panel).toHaveTextContent('Gujarati')
    expect(panel).toHaveTextContent('પાણી')
    // No flip: the presentation word stays visible.
    expect(screen.getByText('eau')).toBeInTheDocument()
  })

  it('reveals on a single tap of the card, which works while locked', async () => {
    await renderPractice()
    const card = screen.getByTestId('practice-card')
    expect(screen.getByText('Tap the card or press Space to reveal')).toBeInTheDocument()

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 102, clientY: 201 })

    // One tap is enough — it is the only thing that unlocks the card.
    expect(screen.getByTestId('reveal-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Correct' })).toBeEnabled()
  })

  it('does nothing when an already-revealed card is tapped', async () => {
    await renderPractice()
    const card = screen.getByTestId('practice-card')
    reveal()

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 100, clientY: 200 })

    await wait(50)
    expect(screen.getByTestId('reveal-panel')).toBeInTheDocument()
    expect(screen.getByText('eau')).toBeInTheDocument()
    expect(loadStore().stats.French).toBeUndefined()
  })

  it('does not reveal on a 30 px drag — that is a swipe attempt, not a tap', async () => {
    await renderPractice()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 130, clientY: 200 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 130, clientY: 200 })

    await wait(350)
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('reveal-hint')).toHaveTextContent('Tap the card to reveal first')
    expect(loadStore().stats.French).toBeUndefined()
  })

  it('records nothing and disables the answer buttons before the reveal', async () => {
    await renderPractice()
    expect(screen.getByRole('button', { name: 'Correct' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Incorrect' })).toBeDisabled()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    // Long enough for a committed swipe to have flown off and recorded.
    await wait(350)
    expect(loadStore().stats.French).toBeUndefined()
    expect(screen.getByText('eau')).toBeInTheDocument()
    expect(screen.getByTestId('reveal-hint')).toBeInTheDocument()
  })

  it('resists a drag and records nothing before the reveal', async () => {
    await renderPractice()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 180, clientY: 205 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 400, clientY: 210 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 400, clientY: 210 })

    await wait(350)
    expect(loadStore().stats.French).toBeUndefined()
    expect(screen.getByTestId('reveal-hint')).toBeInTheDocument()
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()
  })

  it('grades on ArrowRight once the card has been revealed', async () => {
    await renderPractice()
    reveal()
    expect(screen.getByRole('button', { name: 'Correct' })).toBeEnabled()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    expect(loadStore().stats.French[KEY][0].correct).toBe(true)
    // The next card comes up unrevealed, and so locked again.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Correct' })).toBeDisabled())
  })

  it('commits a correct attempt when dragged right past the threshold', async () => {
    await renderPractice()
    reveal()
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
    reveal()
    const card = screen.getByTestId('practice-card')

    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    clock = 1100
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 180, clientY: 200 })
    clock = 1200
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 170, clientY: 200 })
    clock = 1210
    // 30 px in 200 ms: neither far enough nor fast enough.
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 170, clientY: 200 })

    await wait(350)
    expect(loadStore().stats.French).toBeUndefined()
    expect(screen.getByText('eau')).toBeInTheDocument()
  })

  it('commits a fast flick that never reaches the distance threshold', async () => {
    // Real pointermove events are milliseconds apart; jsdom fires them instantly.
    let clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    await renderPractice()
    reveal()
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

    reveal()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    expect(loadStore().stats.French[KEY][0].correct).toBe(true)

    reveal()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(2))
    expect(loadStore().stats.French[KEY][1].correct).toBe(false)
  })

  it('records an attempt from the check button and shows it as a result dot', async () => {
    await renderPractice()
    reveal()

    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))

    const dots = await screen.findByTestId('history-dots')
    expect(dots).toHaveAttribute('aria-label', 'Last 1 results: correct')
    expect(screen.getAllByTestId('history-dot-correct')).toHaveLength(1)
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('shows only the last 10 results as dots, oldest first', async () => {
    // 12 attempts: the two oldest must not be shown.
    const results = [
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]
    seedAttempts(results)
    await renderPractice()

    const dots = screen.getByTestId('history-dots')
    expect(dots.children).toHaveLength(10)
    expect(screen.getAllByTestId('history-dot-incorrect')).toHaveLength(3)
    expect(screen.getAllByTestId('history-dot-correct')).toHaveLength(7)
    expect(dots).toHaveAttribute(
      'aria-label',
      'Last 10 results: incorrect, incorrect, incorrect, correct, correct, correct, correct, correct, correct, correct',
    )

    // Chronological, left to right, in the answer colours.
    const first = dots.children[0]
    const last = dots.children[9]
    expect(first).toHaveAttribute('data-testid', 'history-dot-incorrect')
    expect(last).toHaveAttribute('data-testid', 'history-dot-correct')
    expect(first).toHaveStyle({ backgroundColor: INCORRECT_COLOR })
    expect(last).toHaveStyle({ backgroundColor: CORRECT_COLOR })

    // The percentage caption is gone for good.
    expect(screen.queryByText(/% correct/)).not.toBeInTheDocument()
    expect(screen.queryByText(/seen/)).not.toBeInTheDocument()
  })

  it('undoes the last attempt and brings the card back unrevealed', async () => {
    await renderPractice()
    const undo = screen.getByRole('button', { name: 'Undo last answer' })
    expect(undo).toBeDisabled()

    reveal()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(loadStore().stats.French?.[KEY]).toHaveLength(1))
    await waitFor(() => expect(undo).toBeEnabled())

    fireEvent.click(undo)
    expect(loadStore().stats.French?.[KEY]).toBeUndefined()
    expect(screen.getByText('eau')).toBeInTheDocument()
    expect(screen.queryByTestId('reveal-panel')).not.toBeInTheDocument()
    expect(undo).toBeDisabled()
  })

  it('locks document scrolling while mounted and gives it back on unmount', async () => {
    const { unmount } = await renderPractice()
    // Nothing may scroll under a swipe while a card is on screen.
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    // Words, Dashboard and Settings must scroll normally again afterwards.
    expect(document.body.style.overflow).toBe('')
  })

  it('restores whatever body overflow it found, not a hard-coded one', async () => {
    document.body.style.overflow = 'auto'
    const { unmount } = await renderPractice()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('auto')
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
