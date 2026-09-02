/**
 * Combining marks that act as Latin / Greek / Cyrillic diacritics. Limited to
 * this Unicode block on purpose: Indic vowel signs are combining marks too, and
 * stripping those would mangle Gujarati or Hindi text.
 */
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g

/**
 * Fold a string for searching: lowercase, decompose (NFD), drop combining
 * diacritics, trim. `normalizeText('À propos')` -> `'a propos'`.
 */
export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '').trim()
}
