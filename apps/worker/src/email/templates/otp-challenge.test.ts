import { describe, expect, it } from 'vitest';

import {
  assertValidOtp,
  escapeHtml,
  renderOtpChallenge,
  renderOtpChallengeHtml,
  renderOtpChallengeSubject,
  renderOtpChallengeText,
} from './otp-challenge.js';

const FIXED_EXPIRY = new Date('2026-12-31T12:34:56.000Z');

function fixedContext() {
  return {
    bookingCode: 'RM-AB23-CD45-EF67',
    otp: '482913',
    expiresAt: FIXED_EXPIRY,
  };
}

describe('renderOtpChallengeSubject', () => {
  it('includes the booking code and a verification marker', () => {
    expect(renderOtpChallengeSubject(fixedContext())).toBe(
      'Your verification code for booking RM-AB23-CD45-EF67',
    );
  });
});

describe('renderOtpChallengeText', () => {
  it('contains the 6-digit OTP, the booking code, and the expiry', () => {
    const text = renderOtpChallengeText(fixedContext());
    expect(text).toContain('482913');
    expect(text).toContain('RM-AB23-CD45-EF67');
    expect(text).toContain(FIXED_EXPIRY.toISOString());
    expect(text).toContain('Do not share');
  });

  it('contains no internal identifiers', () => {
    const text = renderOtpChallengeText(fixedContext());
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/challen/i);
    expect(text).not.toMatch(/session/i);
    expect(text).not.toMatch(/nonce/i);
    expect(text).not.toMatch(/digest/i);
  });
});

describe('renderOtpChallengeHtml', () => {
  it('escapes html metacharacters in the booking code', () => {
    const html = renderOtpChallengeHtml({
      bookingCode: '<script>alert(1)</script>',
      otp: '123456',
      expiresAt: FIXED_EXPIRY,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes html metacharacters in the OTP', () => {
    const html = renderOtpChallengeHtml({
      bookingCode: 'RM-AB23-CD45-EF67',
      otp: '<123456>',
      expiresAt: FIXED_EXPIRY,
    });
    expect(html).not.toContain('<123456>');
    expect(html).toContain('&lt;123456&gt;');
  });

  it('contains no session token, challenge ref, nonce, or secret', () => {
    const html = renderOtpChallengeHtml(fixedContext());
    expect(html).not.toMatch(/session/i);
    expect(html).not.toMatch(/nonce/i);
    expect(html).not.toMatch(/secret/i);
    expect(html).not.toMatch(/digest/i);
  });
});

describe('renderOtpChallenge', () => {
  it('returns a coherent {subject, text, html} bundle', () => {
    const rendered = renderOtpChallenge(fixedContext());
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.text).toContain('482913');
    expect(rendered.html).toContain('482913');
  });

  it('throws on non-6-digit OTP', () => {
    expect(() => renderOtpChallenge({ ...fixedContext(), otp: '12345' })).toThrow();
    expect(() => renderOtpChallenge({ ...fixedContext(), otp: 'abcdef' })).toThrow();
    expect(() => renderOtpChallenge({ ...fixedContext(), otp: '1234567' })).toThrow();
  });
});

describe('assertValidOtp', () => {
  it('accepts only six ASCII digits', () => {
    expect(() => assertValidOtp('000000')).not.toThrow();
    expect(() => assertValidOtp('999999')).not.toThrow();
  });

  it('rejects everything else', () => {
    expect(() => assertValidOtp('12345')).toThrow();
    expect(() => assertValidOtp('1234567')).toThrow();
    expect(() => assertValidOtp('12345a')).toThrow();
    expect(() => assertValidOtp('٠١٢٣٤٥')).toThrow();
  });
});

describe('escapeHtml', () => {
  it('escapes all five reserved characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});
