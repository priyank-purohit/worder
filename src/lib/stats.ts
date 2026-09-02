import type { Attempt, WordStats } from './types'

export interface Summary {
  seen: number
  correct: number
  incorrect: number
  /** null when the word has never been seen. */
  pctCorrect: number | null
}

export interface AccuracyPoint {
  t: number
  correct: boolean
  /** Cumulative percentage correct after this attempt. */
  pct: number
}

export interface PresentationAccuracy {
  /** 1-based presentation number. */
  n: number
  /** Percentage correct on the n-th presentation across all words. */
  pct: number
  /** How many words have been presented at least n times. */
  count: number
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

/** Cumulative accuracy after each attempt, oldest first. */
export function runningAccuracy(attempts: Attempt[]): AccuracyPoint[] {
  let correct = 0
  return attempts.map((attempt, i) => {
    if (attempt.correct) correct += 1
    return { t: attempt.t, correct: attempt.correct, pct: pct(correct, i + 1) }
  })
}

/**
 * Accuracy on the n-th presentation of a word, aggregated over every word:
 * "how often do I get a word right the 1st / 2nd / 3rd time I see it?".
 */
export function accuracyByPresentation(allStats: WordStats): PresentationAccuracy[] {
  const totals: number[] = []
  const correct: number[] = []

  for (const attempts of Object.values(allStats)) {
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

function dayKey(t: number): string {
  const d = new Date(t)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Correct/incorrect counts per local calendar day, oldest day first. */
export function attemptsPerDay(allStats: WordStats): DayCount[] {
  const byDay = new Map<string, DayCount>()
  for (const attempts of Object.values(allStats)) {
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
export function hardestWords(
  allStats: WordStats,
  minAttempts = 3,
  limit = 20,
): HardWord[] {
  return Object.entries(allStats)
    .map(([key, attempts]) => ({ key, ...summarize(attempts) }))
    .filter((word): word is HardWord => word.seen >= minAttempts && word.pctCorrect !== null)
    .sort((a, b) => a.pctCorrect - b.pctCorrect || b.seen - a.seen || a.key.localeCompare(b.key))
    .slice(0, limit)
}

/** Totals across every word in one presentation language. */
export function overallSummary(allStats: WordStats): Summary & { words: number } {
  const all = Object.values(allStats).flat()
  return { words: Object.keys(allStats).length, ...summarize(all) }
}
