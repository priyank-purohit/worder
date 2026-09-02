import type { Attempt, WordStats } from './types'

export interface Summary {
  seen: number
  correct: number
  incorrect: number
  /** null when the word has never been seen. */
  pctCorrect: number | null
}

export interface PresentationAccuracy {
  /** 1-based presentation number. */
  n: number
  /** Percentage correct on the n-th presentation across all words. */
  pct: number
  /** How many words have been presented at least n times. */
  count: number
}

export interface HalfDayPeriod {
  /** Epoch ms of the period's start: local midnight for AM, local noon for PM. */
  start: number
  /** `MMM D YYYY AM|PM`, e.g. "Sep 2 2026 PM". */
  label: string
  correct: number
  incorrect: number
  /** Percentage correct within the period. */
  pct: number
  /** Cumulative percentage correct over every attempt up to the end of the period. */
  cumulativePct: number
}

export interface DayCount {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string
  correct: number
  incorrect: number
}

export interface HardWord extends Summary {
  key: string
  pctCorrect: number
}

function pct(correct: number, total: number): number {
  return total === 0 ? 0 : (correct / total) * 100
}

/** Counts and accuracy for one word's attempts. */
export function summarize(attempts: Attempt[]): Summary {
  const seen = attempts.length
  const correct = attempts.reduce((n, a) => n + (a.correct ? 1 : 0), 0)
  return {
    seen,
    correct,
    incorrect: seen - correct,
    pctCorrect: seen === 0 ? null : pct(correct, seen),
  }
}

/**
 * Accuracy on the n-th presentation of a word, aggregated over every word:
 * "how often do I get a word right the 1st / 2nd / 3rd time I see it?".
 */
export function accuracyByPresentation(wordStats: WordStats): PresentationAccuracy[] {
  const totals: number[] = []
  const correct: number[] = []

  for (const attempts of Object.values(wordStats)) {
    attempts.forEach((attempt, i) => {
      totals[i] = (totals[i] ?? 0) + 1
      correct[i] = (correct[i] ?? 0) + (attempt.correct ? 1 : 0)
    })
  }

  return totals.map((count, i) => ({
    n: i + 1,
    pct: pct(correct[i] ?? 0, count),
    count,
  }))
}

/** English short month names, so a label never changes with the runtime locale. */
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Attempts bucketed into local half-days: a local calendar day split at noon,
 * so an attempt before 12:00 lands in that day's "AM" period and anything from
 * 12:00 on lands in its "PM" period. Only periods that contain attempts are
 * returned, oldest first, each carrying its own accuracy and the running
 * accuracy across every attempt up to the end of that period.
 */
export function halfDayPeriods(attempts: Attempt[]): HalfDayPeriod[] {
  const byStart = new Map<number, HalfDayPeriod>()

  for (const attempt of attempts) {
    const when = new Date(attempt.t)
    const half = when.getHours() < 12 ? 'AM' : 'PM'
    const start = new Date(
      when.getFullYear(),
      when.getMonth(),
      when.getDate(),
      half === 'AM' ? 0 : 12,
    ).getTime()
    const entry = byStart.get(start) ?? {
      start,
      label: `${SHORT_MONTHS[when.getMonth()]} ${when.getDate()} ${when.getFullYear()} ${half}`,
      correct: 0,
      incorrect: 0,
      pct: 0,
      cumulativePct: 0,
    }
    if (attempt.correct) entry.correct += 1
    else entry.incorrect += 1
    byStart.set(start, entry)
  }

  let correct = 0
  let seen = 0
  return [...byStart.values()]
    .sort((a, b) => a.start - b.start)
    .map((period) => {
      const inPeriod = period.correct + period.incorrect
      correct += period.correct
      seen += inPeriod
      return {
        ...period,
        pct: pct(period.correct, inPeriod),
        cumulativePct: pct(correct, seen),
      }
    })
}

function dayKey(t: number): string {
  const d = new Date(t)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Correct/incorrect counts per local calendar day, oldest day first. */
export function attemptsPerDay(wordStats: WordStats): DayCount[] {
  const byDay = new Map<string, DayCount>()
  for (const attempts of Object.values(wordStats)) {
    for (const attempt of attempts) {
      const day = dayKey(attempt.t)
      const entry = byDay.get(day) ?? { day, correct: 0, incorrect: 0 }
      if (attempt.correct) entry.correct += 1
      else entry.incorrect += 1
      byDay.set(day, entry)
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/** Words with the worst accuracy first, ignoring words seen too few times. */
export function hardestWords(wordStats: WordStats, minAttempts = 3, limit = 20): HardWord[] {
  return Object.entries(wordStats)
    .map(([key, attempts]) => ({ key, ...summarize(attempts) }))
    .filter((word): word is HardWord => word.seen >= minAttempts && word.pctCorrect !== null)
    .sort((a, b) => a.pctCorrect - b.pctCorrect || b.seen - a.seen || a.key.localeCompare(b.key))
    .slice(0, limit)
}

/** Totals across every word in one presentation language. */
export function overallSummary(wordStats: WordStats): Summary & { words: number } {
  const all = Object.values(wordStats).flat()
  return { words: Object.keys(wordStats).length, ...summarize(all) }
}
