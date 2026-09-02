import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** Size the measurement is taken at; the fitted size scales from it. */
const BASE_PX = 100
/** Share of the available width the widest token is allowed to fill. */
const FILL = 0.92
/** Never shrink past this — below it the card word stops being readable. */
export const MIN_FONT_PX = 20
/** Largest word size on a phone (`sm` and down). */
export const PHONE_MAX_FONT_PX = 56
/** Largest word size on tablet and desktop. */
export const MAX_FONT_PX = 64

export interface UseFitTextResult<T extends HTMLElement> {
  /**
   * Attach to the text element. It must span the whole width the text may use
   * (`width: 100%`), because that width is what the fit is measured against.
   */
  ref: RefObject<T>
  /** Fitted size in px. */
  fontSize: number
}

/** The whitespace-separated tokens of `text`; a token can never be broken. */
export function tokensOf(text: string): string[] {
  return text.split(/\s+/).filter((token) => token !== '')
}

/**
 * True when the text holds no whitespace, so it is safe to keep it on one line
 * with `white-space: nowrap`.
 */
export function isSingleToken(text: string): boolean {
  return tokensOf(text).length <= 1
}

function fontShorthand(style: CSSStyleDeclaration, sizePx: number): string {
  const fontStyle = style.fontStyle || 'normal'
  const weight = style.fontWeight || '400'
  const family = style.fontFamily || 'sans-serif'
  return `${fontStyle} ${weight} ${sizePx}px ${family}`
}

/**
 * Width of the widest token at {@link BASE_PX}, or 0 when it cannot be
 * measured (no 2d canvas, e.g. under jsdom).
 */
function widestTokenWidth(text: string, style: CSSStyleDeclaration): number {
  const tokens = tokensOf(text)
  if (tokens.length === 0) return 0

  let created: CanvasRenderingContext2D | null = null
  try {
    created = document.createElement('canvas').getContext('2d')
  } catch {
    return 0
  }
  const context = created
  if (!context) return 0

  context.font = fontShorthand(style, BASE_PX)
  return tokens.reduce((widest, token) => Math.max(widest, context.measureText(token).width), 0)
}

/** The largest size within `[minPx, maxPx]` at which every token still fits. */
export function fitFontSize(
  element: HTMLElement,
  text: string,
  maxPx: number,
  minPx: number,
): number {
  const available = element.getBoundingClientRect().width || element.clientWidth
  if (available <= 0) return maxPx

  const tokenWidth = widestTokenWidth(text, window.getComputedStyle(element))
  if (tokenWidth <= 0) return maxPx

  const fitted = Math.floor(((available * FILL) / tokenWidth) * BASE_PX)
  return Math.max(minPx, Math.min(maxPx, fitted))
}

/**
 * Sizes text so that its longest whitespace-separated token always fits on one
 * line. The token is measured with an offscreen canvas using the element's own
 * computed font, which needs no layout pass and so cannot loop with the
 * `ResizeObserver` that re-measures the element when the card resizes.
 *
 * Because the fit is decided by the *longest token*, a multi-word entry may
 * still wrap — but only ever at a space.
 */
export function useFitText<T extends HTMLElement = HTMLElement>(
  text: string,
  maxPx: number,
  minPx: number = MIN_FONT_PX,
): UseFitTextResult<T> {
  const ref = useRef<T>(null)
  const [fontSize, setFontSize] = useState(maxPx)

  const remeasure = useCallback(() => {
    const element = ref.current
    if (!element) return
    // Same value in, same value out: React bails out, so no render loop.
    setFontSize(fitFontSize(element, text, maxPx, minPx))
  }, [maxPx, minPx, text])

  // Before paint, so the word is never shown at the wrong size.
  useLayoutEffect(remeasure, [remeasure])

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(remeasure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [remeasure])

  return { ref, fontSize }
}
