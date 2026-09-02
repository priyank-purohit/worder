import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

/** Fraction of the card width a drag must pass to commit on release. */
export const COMMIT_RATIO = 0.35
/** Release speed (px/ms) that commits a swipe regardless of distance. */
export const COMMIT_VELOCITY = 0.5
/** Total movement below this (px) is a tap, not a drag. */
export const TAP_SLOP = 8
/** A second tap within this many ms counts as a double tap. */
export const DOUBLE_TAP_MS = 300
/** How long the card takes to fly off screen. */
export const EXIT_MS = 250
/** How long the card takes to spring back to centre. */
export const RETURN_MS = 200
/** How far a locked card gives before it refuses to move any further, in px. */
const LOCKED_MAX_DX = 12
/** Share of a locked drag that reaches the card, before {@link LOCKED_MAX_DX}. */
const LOCKED_RESISTANCE = 0.2

/** Only pointer samples this recent are used for the release velocity. */
const VELOCITY_WINDOW_MS = 120
/**
 * Below this sample span the velocity is not measurable (browsers coalesce
 * `pointermove` to the frame rate, so a real drag spans far more than this);
 * such a release is judged on distance alone.
 */
const MIN_VELOCITY_SPAN_MS = 5
const MAX_SAMPLES = 6
/** Used before the card has been measured (and in non-DOM environments). */
const FALLBACK_WIDTH = 320

export type SwipePhase = 'idle' | 'drag' | 'exit' | 'return'

export interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
}

export interface UseSwipeOptions {
  /** Called once the card has finished animating off screen. */
  onCommit: (correct: boolean) => void
  /** Called on a double tap / double click on the card. */
  onDoubleTap: () => void
  /**
   * While true the card cannot be graded: a drag resists and springs back, and
   * `fling` does nothing. Double taps still work — that is how it is unlocked.
   */
  locked?: boolean
  /** Called when a locked gesture or fling was refused, so the UI can explain. */
  onBlocked?: () => void
}

export interface UseSwipeResult {
  /** Current horizontal offset of the card, in px. */
  dx: number
  /** `dx` as a signed fraction of the commit threshold, clamped to ±1. */
  progress: number
  phase: SwipePhase
  cardRef: RefObject<HTMLDivElement>
  handlers: SwipeHandlers
  /** Animate the card off screen, then commit (buttons and arrow keys). */
  fling: (correct: boolean) => void
  /** Drop any drag/animation state and recentre the card immediately. */
  reset: () => void
}

interface Sample {
  x: number
  t: number
}

/** Coordinates survive synthetic events that carry no pointer position. */
function coord(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function clamp(value: number, limit = 1): number {
  return Math.max(-limit, Math.min(limit, value))
}

/** A locked drag barely moves: a fifth of the distance, capped, so it feels stuck. */
function resist(dx: number): number {
  return Math.sign(dx) * Math.min(LOCKED_MAX_DX, Math.abs(dx) * LOCKED_RESISTANCE)
}

/** px/ms over the most recent samples; 0 when the finger had already stopped. */
function releaseVelocity(samples: Sample[], releaseT: number): number {
  const last = samples[samples.length - 1]
  if (!last || releaseT - last.t > VELOCITY_WINDOW_MS) return 0
  const oldest = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS) ?? samples[0]
  const dt = last.t - oldest.t
  if (dt < MIN_VELOCITY_SPAN_MS) return 0
  return (last.x - oldest.x) / dt
}

/**
 * Pointer-event drag for the practice card, plus a hand-rolled double-tap
 * detector (`dblclick` is unreliable on touch).
 *
 * A gesture that moves less than {@link TAP_SLOP} never moves the card and is
 * reported as a tap; anything further is a drag that commits past
 * {@link COMMIT_RATIO} of the card width or above {@link COMMIT_VELOCITY}, and
 * springs back otherwise.
 *
 * While `locked` the card may not be graded at all: drags resist and never
 * commit, `fling` is refused, and both report through `onBlocked`.
 */
export function useSwipe({
  onCommit,
  onDoubleTap,
  locked = false,
  onBlocked,
}: UseSwipeOptions): UseSwipeResult {
  const cardRef = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<SwipePhase>('idle')

  const phaseRef = useRef<SwipePhase>('idle')
  const dxRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const movedRef = useRef(0)
  const samplesRef = useRef<Sample[]>([])
  const thresholdRef = useRef(FALLBACK_WIDTH * COMMIT_RATIO)
  const lastTapRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  // Read inside the pointer callbacks, which must not change identity mid-drag.
  const lockedRef = useRef(locked)
  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const goto = useCallback((next: SwipePhase, nextDx: number, nextProgress?: number) => {
    phaseRef.current = next
    dxRef.current = nextDx
    setPhase(next)
    setDx(nextDx)
    setProgress(nextProgress ?? clamp(nextDx / thresholdRef.current))
  }, [])

  const cardWidth = useCallback(() => {
    const width = cardRef.current?.getBoundingClientRect().width ?? 0
    return width > 0 ? width : FALLBACK_WIDTH
  }, [])

  const measure = useCallback(() => {
    thresholdRef.current = Math.max(40, cardWidth() * COMMIT_RATIO)
  }, [cardWidth])

  const fling = useCallback(
    (correct: boolean) => {
      if (phaseRef.current === 'exit') return
      if (lockedRef.current) {
        onBlocked?.()
        return
      }
      pointerIdRef.current = null
      movedRef.current = 0
      lastTapRef.current = 0
      measure()
      const distance = (typeof window === 'undefined' ? 0 : window.innerWidth) + cardWidth()
      clearTimer()
      goto('exit', correct ? distance : -distance)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        // Recentre and commit in one batch so the next card appears without
        // animating back across the screen.
        goto('idle', 0)
        onCommit(correct)
      }, EXIT_MS)
    },
    [cardWidth, clearTimer, goto, measure, onBlocked, onCommit],
  )

  const springBack = useCallback(() => {
    clearTimer()
    if (dxRef.current === 0) {
      phaseRef.current = 'idle'
      setPhase('idle')
      return
    }
    goto('return', 0)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      phaseRef.current = 'idle'
      setPhase('idle')
    }, RETURN_MS)
  }, [clearTimer, goto])

  const reset = useCallback(() => {
    clearTimer()
    pointerIdRef.current = null
    movedRef.current = 0
    samplesRef.current = []
    lastTapRef.current = 0
    goto('idle', 0)
  }, [clearTimer, goto])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (phaseRef.current === 'exit') return
      if (pointerIdRef.current !== null) return
      // Ignore secondary mouse buttons.
      if (typeof event.button === 'number' && event.button > 0) return

      const pointerId = coord(event.pointerId)
      pointerIdRef.current = pointerId
      try {
        event.currentTarget.setPointerCapture?.(pointerId)
      } catch {
        /* pointer capture is best effort */
      }

      const x = coord(event.clientX)
      const y = coord(event.clientY)
      startRef.current = { x, y }
      movedRef.current = 0
      samplesRef.current = [{ x, t: now() }]
      measure()
      clearTimer()
      goto('drag', 0)
    },
    [clearTimer, goto, measure],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (pointerIdRef.current === null) return
      if (coord(event.pointerId) !== pointerIdRef.current) return
      if (phaseRef.current !== 'drag') return

      const x = coord(event.clientX)
      const y = coord(event.clientY)
      const nextDx = x - startRef.current.x
      const distance = Math.hypot(nextDx, y - startRef.current.y)
      if (distance > movedRef.current) movedRef.current = distance
      samplesRef.current = [...samplesRef.current, { x, t: now() }].slice(-MAX_SAMPLES)

      // Below the slop the gesture is still a tap, so the card stays put.
      if (movedRef.current < TAP_SLOP) return
      // Locked: the card gives a few px and shows no tint, because no grade is
      // coming. The double-tap path above is untouched.
      if (lockedRef.current) {
        goto('drag', resist(nextDx), 0)
        return
      }
      goto('drag', nextDx)
    },
    [goto],
  )

  const finish = useCallback(
    (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
      if (pointerIdRef.current === null) return
      if (coord(event.pointerId) !== pointerIdRef.current) return
      pointerIdRef.current = null
      try {
        event.currentTarget.releasePointerCapture?.(coord(event.pointerId))
      } catch {
        /* pointer capture is best effort */
      }

      const moved = movedRef.current
      movedRef.current = 0

      if (cancelled) {
        springBack()
        return
      }

      if (moved < TAP_SLOP) {
        springBack()
        const t = now()
        if (t - lastTapRef.current <= DOUBLE_TAP_MS) {
          lastTapRef.current = 0
          onDoubleTap()
        } else {
          lastTapRef.current = t
        }
        return
      }

      lastTapRef.current = 0
      if (lockedRef.current) {
        springBack()
        onBlocked?.()
        return
      }

      const current = dxRef.current
      const velocity = releaseVelocity(samplesRef.current, now())
      const farEnough = Math.abs(current) > thresholdRef.current
      const fastEnough =
        Math.abs(velocity) > COMMIT_VELOCITY && Math.sign(velocity) === Math.sign(current)
      if (current !== 0 && (farEnough || fastEnough)) fling(current > 0)
      else springBack()
    },
    [fling, onBlocked, onDoubleTap, springBack],
  )

  const handlers = useMemo<SwipeHandlers>(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: (event) => finish(event, false),
      onPointerCancel: (event) => finish(event, true),
    }),
    [finish, onPointerDown, onPointerMove],
  )

  return { dx, progress, phase, cardRef, handlers, fling, reset }
}
