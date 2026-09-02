import { describe, expect, it } from 'vitest'
import type { WordList } from '../../lib/types'
import {
  MAX_OPTIONS,
  buildWordOptions,
  decodeKeyParam,
  filterWordOptions,
  findWordOption,
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
  it('keys and labels every practisable row', () => {
    const options = buildWordOptions(wordList, 'French')
    expect(options.map((option) => option.key)).toEqual([
      'à::to',
      'à::at',
      'eau::water',
      'déjà::already',
    ])
    expect(options[0].label).toBe('à — to / ને')
    expect(options[2].label).toBe('eau — water / પાણી')
  })

  it('follows the presentation language', () => {
    const options = buildWordOptions(wordList, 'English')
    expect(options).toHaveLength(5)
    expect(options[3].key).toBe('hello::નમસ્તે')
    expect(options[3].label).toBe('hello — નમસ્તે')
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

  it('caps the number of matches', () => {
    const many: WordList = {
      languages: ['English', 'French'],
      rows: Array.from({ length: 200 }, (_, i) => ({
        index: i,
        texts: { English: `word ${i}`, French: `mot ${i}` },
      })),
    }
    expect(filterWordOptions(buildWordOptions(many, 'French'), 'mot')).toHaveLength(MAX_OPTIONS)
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
