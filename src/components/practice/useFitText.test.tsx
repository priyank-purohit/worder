import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_FONT_PX, MIN_FONT_PX, isSingleToken, tokensOf, useFitText } from './useFitText'

/** Width the card gives the word, in px. jsdom does no layout, so we say. */
const CARD_WIDTH = 300

function Fit({ text, id }: { text: string; id: string }) {
  const { ref, fontSize } = useFitText<HTMLParagraphElement>(text, MAX_FONT_PX)
  return (
    <p ref={ref} data-testid={id} data-size={fontSize} style={{ fontSize }}>
      {text}
    </p>
  )
}

function sizeOf(id: string): number {
  return Number(screen.getByTestId(id).dataset.size)
}

function rect(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height: 40,
    top: 0,
    right: width,
    bottom: 40,
    left: 0,
    toJSON: () => ({}),
  }
}

/** Every glyph is 0.6 em wide, close enough to a real text face. */
function fakeContext(): { font: string; measureText: (text: string) => { width: number } } {
  const context = {
    font: '10px sans-serif',
    measureText(text: string) {
      const px = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(context.font)?.[1] ?? '16')
      return { width: text.length * 0.6 * px }
    },
  }
  return context
}

const originalGetContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'getContext',
)

beforeEach(() => {
  // jsdom has no 2d canvas and no layout: supply both.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => fakeContext(),
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect(CARD_WIDTH))
})

afterEach(() => {
  vi.restoreAllMocks()
  if (originalGetContext) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', originalGetContext)
  }
})

describe('useFitText', () => {
  it('shrinks a long single word so it fits, leaving a short one at full size', () => {
    render(
      <>
        <Fit text="eau" id="short" />
        <Fit text="internationalement" id="long" />
      </>,
    )

    expect(sizeOf('short')).toBe(MAX_FONT_PX)
    expect(sizeOf('long')).toBeLessThan(sizeOf('short'))
    expect(sizeOf('long')).toBeGreaterThanOrEqual(MIN_FONT_PX)
  })

  it('sizes a phrase by its longest token, so no word can break mid-word', () => {
    render(
      <>
        <Fit text="préoccupation" id="word" />
        <Fit text="de la préoccupation" id="phrase" />
      </>,
    )

    expect(sizeOf('word')).toBeLessThan(MAX_FONT_PX)
    expect(sizeOf('phrase')).toBe(sizeOf('word'))
  })

  it('never shrinks below the minimum', () => {
    render(<Fit text={'a'.repeat(80)} id="absurd" />)
    expect(sizeOf('absurd')).toBe(MIN_FONT_PX)
  })

  it('falls back to the maximum when the element has no width yet', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect(0))
    render(<Fit text="internationalement" id="unmeasured" />)
    expect(sizeOf('unmeasured')).toBe(MAX_FONT_PX)
  })

  it('splits on whitespace and reports single-token text', () => {
    expect(tokensOf('  laisser   tomber ')).toEqual(['laisser', 'tomber'])
    expect(isSingleToken('verrouiller')).toBe(true)
    expect(isSingleToken('à propos de')).toBe(false)
  })
})
