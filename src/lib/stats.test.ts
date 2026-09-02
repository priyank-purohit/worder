import { describe, expect, it } from 'vitest'
import {
  accuracyByPresentation,
  attemptsPerDay,
  hardestWords,
  overallSummary,
  runningAccuracy,
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

describe('runningAccuracy', () => {
  it('is cumulative after each attempt', () => {
    expect(runningAccuracy(stats['à::to']).map((p) => Math.round(p.pct))).toEqual([0, 50, 67])
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
