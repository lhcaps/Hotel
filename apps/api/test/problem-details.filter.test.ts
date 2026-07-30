import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { z } from '@room/contracts';
import { describe, expect, it, vi } from 'vitest';

import { CatalogConflictError } from '../src/catalog/catalog.errors.js';
import { ProblemDetailsFilter } from '../src/errors/problem-details.filter.js';
import { BookingHoldError } from '../src/booking/services/booking-hold.service.js';
import { OtpRateLimitedError } from '../src/booking/services/guest-access-otp-request.service.js';
import { OtpInvalidOrExpiredError } from '../src/booking/services/guest-access-otp-verify.service.js';
import {
  GuestSessionInvalidError,
  GuestSessionRequiredError,
  GuestSessionWrongBookingError,
} from '../src/booking/services/guest-session.service.js';
import { BookingNotFoundError } from '../src/booking/services/booking-detail.service.js';
import {
  QuoteExpiredError,
  QuotePricingConfigurationError,
  QuoteUnavailableError,
} from '../src/pricing/quote.service.js';

function invoke(error: unknown) {
  const send = vi.fn();
  const type = vi.fn().mockReturnValue({ send });
  const status = vi.fn().mockReturnValue({ type });
  const filter = new ProblemDetailsFilter();
  filter.catch(error, {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'request-safe-1' }),
      getResponse: () => ({ status }),
    }),
  } as never);
  return { send, status, type };
}

describe('ProblemDetailsFilter', () => {
  it('redacts unknown failures and includes only a safe request ID', () => {
    const response = invoke(new Error('postgresql://admin:secret@db SELECT token'));
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith({
      type: 'internal-error',
      title: 'Internal server error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'The request could not be completed.',
      requestId: 'request-safe-1',
      errors: [],
    });
  });

  it('normalizes guard, domain, and validation failures', () => {
    expect(
      invoke(new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' })).send,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, code: 'AUTHENTICATION_REQUIRED' }),
    );
    expect(invoke(new CatalogConflictError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, code: 'CATALOG_CONFLICT' }),
    );
    let validationError: unknown;
    try {
      z.object({ code: z.string().min(1) }).parse({ code: '' });
    } catch (error) {
      validationError = error;
    }
    expect(invoke(validationError).send).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'code', message: 'Too small: expected string to have >=1 characters' }],
      }),
    );
    expect(invoke(new BadRequestException({ code: 'BAD_REQUEST' })).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, code: 'BAD_REQUEST' }),
    );
    expect(invoke(new QuoteUnavailableError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, code: 'AVAILABILITY_UNAVAILABLE' }),
    );
    expect(invoke(new QuotePricingConfigurationError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, code: 'PRICING_CONFIGURATION_UNAVAILABLE' }),
    );
    expect(invoke(new QuoteExpiredError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, code: 'QUOTE_EXPIRED' }),
    );
  });

  it('normalizes booking hold and guest access errors', () => {
    expect(
      invoke(new BookingHoldError('QUOTE_NOT_FOUND', 'quote not found')).send,
    ).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: 'QUOTE_NOT_FOUND' }));
    expect(invoke(new BookingHoldError('QUOTE_ALREADY_USED', 'used')).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, code: 'QUOTE_ALREADY_USED' }),
    );
    expect(
      invoke(new BookingHoldError('STALE_HOLD_CLEANUP_RETRY', 'retry')).send,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503, code: 'STALE_HOLD_CLEANUP_RETRY' }),
    );
    expect(invoke(new OtpRateLimitedError(60)).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429, code: 'OTP_RATE_LIMITED', retryAfterSeconds: 60 }),
    );
    expect(invoke(new OtpInvalidOrExpiredError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, code: 'OTP_INVALID_OR_EXPIRED' }),
    );
    expect(invoke(new GuestSessionRequiredError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, code: 'GUEST_SESSION_REQUIRED' }),
    );
    expect(invoke(new GuestSessionInvalidError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, code: 'GUEST_SESSION_INVALID' }),
    );
    expect(invoke(new GuestSessionWrongBookingError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, code: 'GUEST_SESSION_INVALID' }),
    );
    expect(invoke(new BookingNotFoundError()).send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, code: 'BOOKING_NOT_FOUND' }),
    );
  });
});
