import { describe, expect, it } from 'vitest'
import { normalizeText } from './normalize'

describe('normalizeText', () => {
  it('lowercases, strips diacritics and trims', () => {
    expect(normalizeText('À propos')).toBe('a propos')
  })

  it('folds French accents and cedillas', () => {
    expect(normalizeText('  Élève, ça va ?  ')).toBe('eleve, ca va ?')
  })

  it('is idempotent', () => {
    const once = normalizeText('Œuvre — Déjà vu')
    expect(once).toBe('œuvre — deja vu')
    expect(normalizeText(once)).toBe(once)
  })

  it('leaves Indic vowel signs intact', () => {
    expect(normalizeText(' પાણી ')).toBe('પાણી')
    expect(normalizeText('हिन्दी')).toBe('हिन्दी')
  })

  it('returns an empty string for blank input', () => {
    expect(normalizeText('   ')).toBe('')
    expect(normalizeText('')).toBe('')
  })
})
