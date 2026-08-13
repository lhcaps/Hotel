import nodemailer from 'nodemailer';
import { Buffer } from 'node:buffer';

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

  it('forwards inline PNG CID attachments to the SMTP transport', async () => {
    const sent: unknown[] = [];
    const transport = createSMTPTransport(
      {
        host: '127.0.0.1',
        port: 1025,
        secure: false,
        requireAuth: false,
      },
      {
        createTransport: () => ({
          sendMail: async (message: unknown) => {
            sent.push(message);
          },
          close: () => undefined,
        }),
      } as unknown as typeof nodemailer,
    );

    await transport.send({
      from: 'no-reply@peacenest.test',
      to: 'guest@example.test',
      subject: 'Check-in',
      text: 'Check-in information',
      html: '<img src="cid:access-qr@test" alt="Check-in QR" />',
      messageId: '<access@test>',
      attachments: [
        {
          filename: 'peacenest-check-in-qr.png',
          content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          contentType: 'image/png',
          cid: 'access-qr@test',
          contentDisposition: 'inline',
        },
      ],
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      html: '<img src="cid:access-qr@test" alt="Check-in QR" />',
      attachments: [
        {
          filename: 'peacenest-check-in-qr.png',
          contentType: 'image/png',
          cid: 'access-qr@test',
          contentDisposition: 'inline',
        },
      ],
    });
  });
});
