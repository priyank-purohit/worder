import { describe, expect, it } from 'vitest'
import { pickNext } from './scheduler'
import type { Settings, WordRow } from './types'

/** Deterministic rng that walks a fixed list of values, then repeats. */
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

const settings = (over: Partial<Settings> = {}): Settings => ({
  presentationLanguage: 'French',
  topN: 3,
  topShare: 0.7,
  ...over,
})

const rows: WordRow[] = Array.from({ length: 10 }, (_, index) => ({
  index,
  texts: { English: `w${index}`, French: `f${index}` },
}))

describe('pickNext', () => {
  it('draws from the top pool when rng is below topShare', () => {
    // first rng() = pool choice, second = index within the pool
    const row = pickNext(rows, settings(), [], seq([0.1, 0]))
    expect(row.index).toBe(0)
  })

  it('draws from the rest pool when rng is above topShare', () => {
    const row = pickNext(rows, settings(), [], seq([0.9, 0]))
    expect(row.index).toBe(3)
  })

  it('falls back to the other pool when the chosen one is empty', () => {
    const row = pickNext(rows, settings({ topN: 100 }), [], seq([0.9, 0]))
    expect(row.index).toBe(0)
  })

  it('skips only rows eligible in the presentation language', () => {
    const mixed: WordRow[] = [
      { index: 0, texts: { English: 'a', Hindi: 'एक' } },
      { index: 1, texts: { English: 'b', French: 'fb' } },
    ]
    expect(pickNext(mixed, settings(), [], seq([0.1, 0])).index).toBe(1)
  })

  it('avoids the last five keys when the pool is large enough', () => {
    const recent = ['f0::w0', 'f1::w1', 'f2::w2', 'f3::w3', 'f4::w4']
    const row = pickNext(rows, settings({ topN: 100 }), recent, seq([0.1, 0]))
    expect(row.index).toBe(5)
  })

  it('ignores the recent list when the pool is small', () => {
    const small = rows.slice(0, 4)
    const recent = small.map((r) => `f${r.index}::w${r.index}`)
    expect(pickNext(small, settings({ topN: 100 }), recent, seq([0.1, 0])).index).toBe(0)
  })

  it('throws when nothing is eligible', () => {
    expect(() => pickNext(rows, settings({ presentationLanguage: 'Klingon' }), [])).toThrow()
  })

  it('is deterministic for a given rng', () => {
    const a = pickNext(rows, settings(), [], seq([0.5, 0.99]))
    const b = pickNext(rows, settings(), [], seq([0.5, 0.99]))
    expect(a.index).toBe(b.index)
  })
})
