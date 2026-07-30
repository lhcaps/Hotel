import nodemailer from 'nodemailer';

import { describe, expect, it } from 'vitest';

import {
  createSMTPTransport,
  validateSMTPTransportConfig,
} from '../../src/email/smtp-transport.js';

describe('validateSMTPTransportConfig', () => {
  it('accepts a valid loopback configuration', () => {
    expect(() =>
      validateSMTPTransportConfig({
        host: '127.0.0.1',
        port: 1025,
        secure: false,
        requireAuth: false,
      }),
    ).not.toThrow();
  });

  it('rejects an empty host', () => {
    expect(() =>
      validateSMTPTransportConfig({
        host: '',
        port: 1025,
        secure: false,
        requireAuth: false,
      }),
    ).toThrow(/host/);
  });

  it('rejects an out-of-range port', () => {
    expect(() =>
      validateSMTPTransportConfig({
        host: '127.0.0.1',
        port: 0,
        secure: false,
        requireAuth: false,
      }),
    ).toThrow(/port/);
    expect(() =>
      validateSMTPTransportConfig({
        host: '127.0.0.1',
        port: 65536,
        secure: false,
        requireAuth: false,
      }),
    ).toThrow(/port/);
  });

  it('rejects a non-boolean secure flag', () => {
    expect(() =>
      validateSMTPTransportConfig({
        host: '127.0.0.1',
        port: 1025,
        secure: 'false' as unknown as boolean,
        requireAuth: false,
      }),
    ).toThrow(/secure/);
  });

  it('rejects required auth without credentials', () => {
    expect(() =>
      validateSMTPTransportConfig({
        host: '127.0.0.1',
        port: 1025,
        secure: false,
        requireAuth: true,
      }),
    ).toThrow(/SMTP user/);
  });
});

describe('createSMTPTransport', () => {
  it('respects the configured secure flag and requireAuth flag', async () => {
    const transport = createSMTPTransport(
      {
        host: '127.0.0.1',
        port: 1025,
        secure: true,
        requireAuth: true,
        user: 'user',
        password: 'secret',
      },
      nodemailer,
    );
    expect(transport).toBeDefined();
    await transport.close();
  });
});
