/**
 * Booking code generation and normalization
 *
 * Alphabet: 32 characters excluding 0, O, I, L
 * Format: RM-XXXX-XXXX-XXXX (12 symbols, 60 bits entropy)
 */

import { randomInt } from 'node:crypto';

const ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ALPHABET_SIZE = 32;
const SEGMENT_LENGTH = 4;
const SEGMENT_COUNT = 3;

export type RandomIndexSource = (upperExclusive: number) => number;

const defaultRandomIndexSource: RandomIndexSource = (upperExclusive: number) => {
  return randomInt(0, upperExclusive);
};

function pickAlphabetChar(randomIndexSource: RandomIndexSource, upperExclusive: number): string {
  const index = randomIndexSource(upperExclusive);

  if (!Number.isInteger(index) || index < 0 || index >= upperExclusive) {
    throw new Error(
      `Invalid random index: expected an integer in [0, ${upperExclusive}), received ${index}`,
    );
  }

  const char = ALPHABET[index];
  if (char === undefined) {
    throw new Error(
      `Invalid random index: expected an integer in [0, ${upperExclusive}), received ${index}`,
    );
  }

  return char;
}

export function generateBookingCode(
  randomIndexSource: RandomIndexSource = defaultRandomIndexSource,
): string {
  const segments: string[] = [];

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    let segment = '';
    for (let j = 0; j < SEGMENT_LENGTH; j++) {
      segment += pickAlphabetChar(randomIndexSource, ALPHABET_SIZE);
    }
    segments.push(segment);
  }

  return `RM-${segments.join('-')}`;
}

const BOOKING_CODE_REGEX = /^RM-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}$/;
const EXCLUDED_CHARS = ['0', 'O', 'I', 'L'];

export function normalizeBookingCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();

  for (const excluded of EXCLUDED_CHARS) {
    if (trimmed.includes(excluded)) {
      throw new Error(`Booking code contains excluded character: ${excluded}`);
    }
  }

  if (!BOOKING_CODE_REGEX.test(trimmed)) {
    throw new Error(`Invalid booking code format: ${raw}`);
  }

  return trimmed;
}
