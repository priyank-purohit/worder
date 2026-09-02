import { describe, expect, it } from 'vitest'
import type { WordRow } from './types'
import { otherLanguages, wordKey } from './wordKey'

const LANGS = ['English', 'French', 'Gujarati', 'Hindi']
const row = (texts: Record<string, string>, index = 0): WordRow => ({ index, texts })

describe('otherLanguages', () => {
  it('drops the presentation language and keeps header order', () => {
    expect(otherLanguages(LANGS, 'French')).toEqual(['English', 'Gujarati', 'Hindi'])
  })
})

describe('wordKey', () => {
  it('pairs the presentation text with the first other language present', () => {
    expect(wordKey(row({ English: 'to', French: 'à' }), 'French', LANGS)).toBe('à::to')
  })

  it('disambiguates homographs', () => {
    const to = wordKey(row({ English: 'to', French: 'à' }), 'French', LANGS)
    const at = wordKey(row({ English: 'at', French: 'à' }), 'French', LANGS)
    expect(to).not.toBe(at)
  })

  it('falls back to the next available language', () => {
    expect(wordKey(row({ French: 'à', Hindi: 'को' }), 'French', LANGS)).toBe('à::को')
  })

  it('returns null when the row has no presentation text', () => {
    expect(wordKey(row({ English: 'to', Hindi: 'को' }), 'French', LANGS)).toBeNull()
  })

  it('defaults the language order to the row itself', () => {
    expect(wordKey(row({ English: 'to', French: 'à' }), 'French')).toBe('à::to')
  })
})
