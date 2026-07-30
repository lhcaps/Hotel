import { describe, expect, it } from 'vitest';

import { assertSafePaymentRedirect } from '../src/lib/payment-redirect';

describe('assertSafePaymentRedirect', () => {
  describe('HTTPS', () => {
    it('accepts a sandbox HTTPS provider URL in production', () => {
      const url = assertSafePaymentRedirect('https://sandbox-provider.example/pay', 'production');
      expect(url.protocol).toBe('https:');
      expect(url.host).toBe('sandbox-provider.example');
    });

    it('accepts a sandbox HTTPS provider URL in development', () => {
      const url = assertSafePaymentRedirect('https://sandbox-provider.example/pay', 'development');
      expect(url.protocol).toBe('https:');
    });

    it('accepts a sandbox HTTPS provider URL in test', () => {
      const url = assertSafePaymentRedirect('https://sandbox-provider.example/pay', 'test');
      expect(url.protocol).toBe('https:');
    });
  });

  describe('HTTP loopback (development and test only)', () => {
    it('accepts http://127.0.0.1:3090/momo-test/pay in development', () => {
      const url = assertSafePaymentRedirect('http://127.0.0.1:3090/momo-test/pay', 'development');
      expect(url.hostname).toBe('127.0.0.1');
      expect(url.protocol).toBe('http:');
    });

    it('accepts http://localhost:3090/vnpay-test/pay in test', () => {
      const url = assertSafePaymentRedirect('http://localhost:3090/vnpay-test/pay', 'test');
      expect(url.hostname).toBe('localhost');
    });

    it('accepts http://[::1]:3090/pay in development', () => {
      const url = assertSafePaymentRedirect('http://[::1]:3090/pay', 'development');
      expect(url.hostname).toBe('[::1]');
    });
  });

  describe('rejections', () => {
    it('rejects an external HTTP host in development', () => {
      expect(() => assertSafePaymentRedirect('http://evil.example/pay', 'development')).toThrow();
    });

    it('rejects an HTTP LAN host in development', () => {
      expect(() =>
        assertSafePaymentRedirect('http://192.168.1.20:3090/pay', 'development'),
      ).toThrow();
    });

    it('rejects javascript: URLs', () => {
      expect(() => assertSafePaymentRedirect('javascript:alert(1)', 'development')).toThrow();
    });

    it('rejects data: URLs', () => {
      expect(() =>
        assertSafePaymentRedirect('data:text/html,<script>alert(1)</script>', 'development'),
      ).toThrow();
    });

    it('rejects HTTP loopback in production', () => {
      expect(() => assertSafePaymentRedirect('http://127.0.0.1:3090/pay', 'production')).toThrow();
    });

    it('rejects URLs with embedded credentials', () => {
      expect(() =>
        assertSafePaymentRedirect('http://user:password@127.0.0.1:3090/pay', 'development'),
      ).toThrow();
    });

    it('rejects malformed URLs', () => {
      expect(() => assertSafePaymentRedirect('not a real url at all', 'development')).toThrow();
    });
  });
});
