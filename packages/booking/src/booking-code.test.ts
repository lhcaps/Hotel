import { describe, it, expect } from 'vitest';
import {
  generateBookingCode,
  normalizeBookingCode,
  type RandomIndexSource,
} from './booking-code.js';

describe('generateBookingCode', () => {
  it('returns a string matching the booking code format', () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^RM-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}$/);
  });

  it('produces identical strings with the same injected RandomIndexSource', () => {
    const fixedSequence = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    let cursor = 0;
    const deterministicSource: RandomIndexSource = () => {
      const value = fixedSequence[cursor++];
      if (value === undefined) throw new Error('Sequence exhausted');
      return value;
    };

    cursor = 0;
    const code1 = generateBookingCode(deterministicSource);

    cursor = 0;
    const code2 = generateBookingCode(deterministicSource);

    expect(code1).toBe(code2);
  });

  it('excludes 0, O, I, L over 100 generations', () => {
    const excludedChars = ['0', 'O', 'I', 'L'];
    let seed = 12345;

    // Linear congruential generator for deterministic randomness
    const lcgSource: RandomIndexSource = (upperExclusive: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % upperExclusive;
    };

    for (let i = 0; i < 100; i++) {
      const code = generateBookingCode(lcgSource);
      for (const excluded of excludedChars) {
        expect(code).not.toContain(excluded);
      }
    }
  });

  it('rejects a negative injected index instead of producing "undefined"', () => {
    expect(() => generateBookingCode(() => -1)).toThrow(/invalid random index/i);
  });

  it('rejects an injected index equal to the alphabet size', () => {
    expect(() => generateBookingCode(() => 32)).toThrow(/invalid random index/i);
  });

  it('rejects an injected index greater than the alphabet size', () => {
    expect(() => generateBookingCode(() => 100)).toThrow(/invalid random index/i);
  });

  it('rejects a fractional injected index', () => {
    expect(() => generateBookingCode(() => 1.5)).toThrow(/invalid random index/i);
  });

  it('rejects a NaN injected index', () => {
    expect(() => generateBookingCode(() => Number.NaN)).toThrow(/invalid random index/i);
  });

  it('rejects an Infinity injected index', () => {
    expect(() => generateBookingCode(() => Number.POSITIVE_INFINITY)).toThrow(
      /invalid random index/i,
    );
  });

  it('never produces the literal string "undefined" for any invalid index attempt', () => {
    for (const badIndex of [
      -1,
      32,
      100,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => generateBookingCode(() => badIndex)).toThrow();
    }
  });
});

describe('normalizeBookingCode', () => {
  it('trims whitespace and uppercases', () => {
    const result = normalizeBookingCode('  rm-abcd-ef23-jkmn ');
    expect(result).toBe('RM-ABCD-EF23-JKMN');
  });

  it('throws when input contains L', () => {
    expect(() => normalizeBookingCode('RM-ABCL-EFGH-JKMN')).toThrow('excluded character: L');
  });

  it('throws when input contains 0', () => {
    expect(() => normalizeBookingCode('RM-ABC0-EFGH-JKMN')).toThrow('excluded character: 0');
  });

  it('throws when input contains O', () => {
    expect(() => normalizeBookingCode('RM-ABCO-EFGH-JKMN')).toThrow('excluded character: O');
  });

  it('throws when input contains I', () => {
    expect(() => normalizeBookingCode('RM-ABCI-EFGH-JKMN')).toThrow('excluded character: I');
  });

  it('validates format strictly', () => {
    expect(() => normalizeBookingCode('RM-ABC-EFGH-JKMN')).toThrow('Invalid booking code format');
    expect(() => normalizeBookingCode('ABCD-EFGH-JKMN')).toThrow('Invalid booking code format');
    expect(() => normalizeBookingCode('RM-ABCD-EFGH')).toThrow('Invalid booking code format');
  });
});
