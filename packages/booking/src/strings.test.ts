import { describe, it, expect } from 'vitest';
import { collapseWhitespace, normalizeUnicode } from './strings.js';

describe('collapseWhitespace', () => {
  it('collapses multiple spaces to single space', () => {
    expect(collapseWhitespace('a   b   c')).toBe('a b c');
  });

  it('trims leading and trailing whitespace', () => {
    expect(collapseWhitespace('  a b c  ')).toBe('a b c');
  });

  it('handles tabs and newlines', () => {
    expect(collapseWhitespace('a\t\tb\n\nc')).toBe('a b c');
  });
});

describe('normalizeUnicode', () => {
  it('normalizes to NFC form', () => {
    const decomposed = 'e\u0301'; // é as e + combining acute
    const composed = 'é'; // é as single character

    expect(normalizeUnicode(decomposed)).toBe(composed);
  });
});
