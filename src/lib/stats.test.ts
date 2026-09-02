import { describe, expect, it } from 'vitest'
import {
  accuracyByPresentation,
  attemptsPerDay,
  halfDayPeriods,
  hardestWords,
  overallSummary,
  summarize,
} from './stats'
import type { Attempt, WordStats } from './types'

const at = (iso: string, correct: boolean): Attempt => ({ t: new Date(iso).getTime(), correct })

const stats: WordStats = {
  'à::to': [at('2026-01-01T10:00:00', false), at('2026-01-01T11:00:00', true), at('2026-01-02T10:00:00', true)],
  'un::a': [at('2026-01-01T12:00:00', true), at('2026-01-02T12:00:00', true)],
  'eau::water': [at('2026-01-02T13:00:00', false)],
}

describe('summarize', () => {
  it('counts and computes accuracy', () => {
    expect(summarize(stats['à::to'])).toEqual({
      seen: 3,
      correct: 2,
      incorrect: 1,
      pctCorrect: (2 / 3) * 100,
    })
  })

  it('returns null accuracy when never seen', () => {
    expect(summarize([])).toEqual({ seen: 0, correct: 0, incorrect: 0, pctCorrect: null })
  })
})

describe('accuracyByPresentation', () => {
  it('reports accuracy and sample count per presentation number', () => {
    const byN = accuracyByPresentation(stats)
    expect(byN.map((p) => p.n)).toEqual([1, 2, 3])
    expect(byN[0]).toEqual({ n: 1, pct: (1 / 3) * 100, count: 3 })
    expect(byN[2]).toEqual({ n: 3, pct: 100, count: 1 })
  })
})

describe('halfDayPeriods', () => {
  /** A local wall-clock attempt, so the AM/PM split is not zone-dependent. */
  const local = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    correct: boolean,
  ): Attempt => ({ t: new Date(year, month, day, hour, minute).getTime(), correct })

  it('splits a local calendar day at noon', () => {
    const periods = halfDayPeriods([
      local(2026, 8, 2, 11, 59, true),
      local(2026, 8, 2, 12, 0, false),
    ])

    expect(periods.map((p) => p.label)).toEqual(['Sep 2 2026 AM', 'Sep 2 2026 PM'])
    expect(periods[0].start).toBe(new Date(2026, 8, 2, 0, 0).getTime())
    expect(periods[1].start).toBe(new Date(2026, 8, 2, 12, 0).getTime())
    expect(periods[0]).toMatchObject({ correct: 1, incorrect: 0, pct: 100, cumulativePct: 100 })
    expect(periods[1]).toMatchObject({ correct: 0, incorrect: 1, pct: 0, cumulativePct: 50 })
  })

  it('returns only the periods with attempts, oldest first', () => {
    // Deliberately out of order: the output is chronological either way.
    const periods = halfDayPeriods([
      local(2026, 8, 4, 8, 30, false),
      local(2026, 8, 2, 13, 0, true),
      local(2026, 8, 1, 9, 0, false),
      local(2026, 8, 2, 15, 30, true),
    ])

    expect(periods.map((p) => p.label)).toEqual([
      'Sep 1 2026 AM',
      'Sep 2 2026 PM',
      'Sep 4 2026 AM',
    ])
    expect(periods.map((p) => p.pct)).toEqual([0, 100, 0])
    expect(periods.map((p) => p.cumulativePct)).toEqual([0, (2 / 3) * 100, 50])
    expect(periods.map((p) => p.correct + p.incorrect)).toEqual([1, 2, 1])
  })

  it('crosses a month boundary and pads nothing', () => {
    const periods = halfDayPeriods([
      local(2025, 11, 31, 23, 0, true),
      local(2026, 0, 1, 0, 0, true),
    ])
    expect(periods.map((p) => p.label)).toEqual(['Dec 31 2025 PM', 'Jan 1 2026 AM'])
  })

  it('is empty without attempts', () => {
    expect(halfDayPeriods([])).toEqual([])
  })
})

describe('attemptsPerDay', () => {
  it('groups by local day, oldest first', () => {
    expect(attemptsPerDay(stats)).toEqual([
      { day: '2026-01-01', correct: 2, incorrect: 1 },
      { day: '2026-01-02', correct: 2, incorrect: 1 },
    ])
  })
})

describe('hardestWords', () => {
  it('respects minAttempts and sorts worst first', () => {
    expect(hardestWords(stats, 2).map((w) => w.key)).toEqual(['à::to', 'un::a'])
    expect(hardestWords(stats, 3).map((w) => w.key)).toEqual(['à::to'])
    expect(hardestWords(stats, 2, 1)).toHaveLength(1)
  })
})

describe('overallSummary', () => {
  it('totals every word', () => {
    expect(overallSummary(stats)).toEqual({ words: 3, seen: 6, correct: 4, incorrect: 2, pctCorrect: (4 / 6) * 100 })
  })
})
