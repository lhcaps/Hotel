/**
 * String manipulation utilities
 */

export function collapseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function normalizeUnicode(input: string): string {
  return input.normalize('NFC');
}
