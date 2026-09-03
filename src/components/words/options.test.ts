import { describe, expect, it } from 'vitest'
import type { WordList, WordStats } from '../../lib/types'
import {
  accuracyByKey,
  buildWordOptions,
  decodeKeyParam,
  filterWordOptions,
  findWordOption,
  summarizeOptions,
} from './options'

const wordList: WordList = {
  languages: ['English', 'French', 'Gujarati'],
  rows: [
    { index: 0, texts: { English: 'to', French: 'à', Gujarati: 'ને' } },
    { index: 1, texts: { English: 'at', French: 'à' } },
    { index: 2, texts: { English: 'water', French: 'eau', Gujarati: 'પાણી' } },
    // No French text: not practisable in French.
    { index: 3, texts: { English: 'hello', Gujarati: 'નમસ્તે' } },
    { index: 4, texts: { English: 'already', French: 'déjà' } },
  ],
}

describe('buildWordOptions', () => {
  it('keys every practisable row and joins its other languages', () => {
    const options = buildWordOptions(wordList, 'French')
    expect(options.map((option) => option.key)).toEqual([
      'à::to',
      'à::at',
      'eau::water',
      'déjà::already',
    ])
    expect(options[0].others).toBe('to / ને')
    expect(options[2].others).toBe('water / પાણી')
  })

  it('follows the presentation language', () => {
    const options = buildWordOptions(wordList, 'English')
    expect(options).toHaveLength(5)
    expect(options[3].key).toBe('hello::નમસ્તે')
    expect(options[3].others).toBe('નમસ્તે')
  })
})

describe('filterWordOptions', () => {
  const options = buildWordOptions(wordList, 'French')

  it('ignores case and diacritics', () => {
    expect(filterWordOptions(options, 'DEJA').map((option) => option.key)).toEqual([
      'déjà::already',
    ])
  })

  it('matches any language on the row', () => {
    expect(filterWordOptions(options, 'પાણી').map((option) => option.key)).toEqual(['eau::water'])
    expect(filterWordOptions(options, 'wat').map((option) => option.key)).toEqual(['eau::water'])
  })

  it('returns everything for blank input', () => {
    expect(filterWordOptions(options, '   ')).toHaveLength(options.length)
  })

  it('does not cap the matches — the grid shows the whole list', () => {
    const many: WordList = {
      languages: ['English', 'French'],
      rows: Array.from({ length: 200 }, (_, i) => ({
        index: i,
        texts: { English: `word ${i}`, French: `mot ${i}` },
      })),
    }
    expect(filterWordOptions(buildWordOptions(many, 'French'), 'mot')).toHaveLength(200)
  })
})

describe('decodeKeyParam', () => {
  it('restores a slash that survived path matching encoded', () => {
    expect(decodeKeyParam('a%2Fb::x')).toBe('a/b::x')
  })

  it('leaves an ordinary key alone', () => {
    expect(decodeKeyParam('déjà::already')).toBe('déjà::already')
  })
})

describe('findWordOption', () => {
  const options = buildWordOptions(wordList, 'French')

  it('finds a key and reports a missing one', () => {
    expect(findWordOption(options, 'eau::water')?.row.index).toBe(2)
    expect(findWordOption(options, 'nope::nope')).toBeNull()
    expect(findWordOption(options, null)).toBeNull()
  })
})

const wordStats: WordStats = {
  'eau::water': [
    { t: 1, correct: true },
    { t: 2, correct: false },
    { t: 3, correct: true },
  ],
  'déjà::already': [{ t: 4, correct: false }],
  // A key the word file no longer has: counted nowhere.
  'gone::away': [{ t: 5, correct: true }],
}

describe('accuracyByKey', () => {
  it('scores only the words that have been practised', () => {
    const accuracy = accuracyByKey(wordStats)
    expect(accuracy.get('eau::water')).toBeCloseTo(66.67, 1)
    expect(accuracy.get('déjà::already')).toBe(0)
    expect(accuracy.has('à::to')).toBe(false)
  })

  it('is empty without stats', () => {
    expect(accuracyByKey({}).size).toBe(0)
  })
})

describe('summarizeOptions', () => {
  const options = buildWordOptions(wordList, 'French')

  it('counts the listed words, how many are seen, and their accuracy', () => {
    expect(summarizeOptions(options, wordStats)).toEqual({
      words: 4,
      seen: 2,
      pctCorrect: 50,
    })
  })

  it('follows the filter', () => {
    const filtered = filterWordOptions(options, 'eau')
    expect(summarizeOptions(filtered, wordStats)).toEqual({
      words: 1,
      seen: 1,
      pctCorrect: (2 / 3) * 100,
    })
  })

  it('has no percentage when nothing has been seen', () => {
    expect(summarizeOptions(options, {})).toEqual({ words: 4, seen: 0, pctCorrect: null })
  })
})
