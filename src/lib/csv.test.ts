import { describe, expect, it } from 'vitest'
import { parseWordList } from './csv'

const CSV = [
  'English,French,Gujarati,Hindi',
  'a, un ,એક,एक',
  'along,le long de,સાથે,साथ में',
  'lonely,,,',
  '"hello, there",bonjour,,',
  'to,à,,',
].join('\n')

describe('parseWordList', () => {
  it('reads the header as the language list', () => {
    expect(parseWordList(CSV).languages).toEqual(['English', 'French', 'Gujarati', 'Hindi'])
  })

  it('trims cells and omits empty ones', () => {
    const { rows } = parseWordList(CSV)
    expect(rows[0].texts).toEqual({ English: 'a', French: 'un', Gujarati: 'એક', Hindi: 'एक' })
    expect(rows[3].texts).toEqual({ English: 'to', French: 'à' })
  })

  it('skips rows with fewer than two non-empty cells but keeps file positions', () => {
    const { rows } = parseWordList(CSV)
    expect(rows.map((r) => r.index)).toEqual([0, 1, 3, 4])
    expect(rows.some((r) => r.texts.English === 'lonely')).toBe(false)
  })

  it('honours quoted commas', () => {
    const row = parseWordList(CSV).rows.find((r) => r.index === 3)
    expect(row?.texts.English).toBe('hello, there')
  })

  it('returns an empty list for empty input', () => {
    expect(parseWordList('')).toEqual({ languages: [], rows: [] })
  })
})
