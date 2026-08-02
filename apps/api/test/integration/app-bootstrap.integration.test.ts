import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { createApiHttpAdapter } from '../../src/http-adapter.js';

let application: NestFastifyApplication;

describe('application bootstrap', () => {
  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      API_HOST: '127.0.0.1',
      API_PORT: '3199',
      WEB_ORIGIN: 'http://127.0.0.1:3100',
      AUTH_BASE_URL: 'http://127.0.0.1:3199',
      DATABASE_URL: 'postgresql://room:room@127.0.0.1:5432/room_management_test_base',
      REDIS_URL: 'redis://127.0.0.1:6379',
      MAIL_HOST: '127.0.0.1',
      MAIL_PORT: '1025',
      MAIL_FROM: 'no-reply@room-management.local',
      BETTER_AUTH_SECRET: 'local-dev-only-secret-with-at-least-thirty-two-characters',
      GUEST_OTP_SECRET: 'test-guest-otp-secret-32-chars-min-aaaaaa',
      GUEST_CHALLENGE_REF_SECRET: 'test-challenge-ref-secret-32-chars-aaaa',
      GUEST_SESSION_SECRET: 'test-guest-session-secret-32-chars-aaaaa',
      BOOKING_IP_DIGEST_SECRET: 'test-ip-digest-secret-32-chars-aaaaa',
      BOOKING_ACCESS_QR_SECRET: 'test-booking-access-qr-secret-32-chars-aaaa',
      MOMO_ENABLED: 'false',
      VNPAY_ENABLED: 'false',
    });
    application = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      createApiHttpAdapter(),
      {
        abortOnError: false,
        logger: false,
      },
    );
    await application.init();
  });

  afterAll(async () => {
    await application?.close();
  });

  it('initializes all Phase 7E module providers', () => {
    expect(application).toBeDefined();
  });
});
