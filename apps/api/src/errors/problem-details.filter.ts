import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { z } from '@room/contracts';
import { createLogger } from '@room/observability';

import { CatalogConflictError, CatalogNotFoundError } from '../catalog/catalog.errors.js';
import { CatalogSafetyError } from '../catalog/catalog.safety.js';
import {
  QuoteExpiredError,
  QuoteNotFoundError,
  QuotePricingConfigurationError,
  QuoteUnavailableError,
  CouponExpiredError as QuoteCouponExpiredError,
  CouponInvalidInputError as QuoteCouponInvalidInputError,
  CouponMinimumNotMetError as QuoteCouponMinimumNotMetError,
  CouponNotApplicableError as QuoteCouponNotApplicableError,
} from '../pricing/quote.service.js';
import {
  CouponExpiredError as CouponRepoExpiredError,
  CouponMinimumNotMetError as CouponRepoMinimumNotMetError,
  CouponNotApplicableError as CouponRepoNotApplicableError,
} from '../pricing/coupon.repository.js';
import { BookingHoldError } from '../booking/services/booking-hold.service.js';
import { OtpRateLimitedError } from '../booking/services/guest-access-otp-request.service.js';
import { OtpInvalidOrExpiredError } from '../booking/services/guest-access-otp-verify.service.js';
import {
  GuestSessionInvalidError,
  GuestSessionRequiredError,
  GuestSessionWrongBookingError,
} from '../booking/services/guest-session.service.js';
import {
  BookingTransitionError,
  NoShowBeforeCheckInError,
  OperationalReviewAlreadyResolvedError,
  OperationalReviewNotFoundError,
} from '../booking/admin-booking.errors.js';
import {
  CustomerDisabledError,
  CustomerSessionRequiredError,
} from '../auth/customer-session.service.js';
import { BookingNotFoundError } from '../booking/services/booking-detail.service.js';
import { BookingAccessPassError } from '../booking/services/booking-access-pass.service.js';
import { CouponDeliveryError } from '../booking/coupon-delivery.errors.js';
import { PaymentInitiationError } from '../payment/payment.errors.js';
import { PaymentProviderSettingsError } from '../payment/payment-provider-settings.errors.js';

const logger = createLogger({ service: 'api', environment: process.env.NODE_ENV ?? 'unknown' });

type ProblemReply = {
  status(status: number): { type(value: string): { send(body: unknown): void } };
};

type ProblemRequest = { id: string };

function httpCode(error: HttpException): string {
  const response = error.getResponse();
  return typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    typeof response.code === 'string'
    ? response.code
    : `HTTP_${error.getStatus()}`;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  public catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ProblemRequest>();
    const reply = http.getResponse<ProblemReply>();
    const base = {
      requestId: request.id,
      errors: [] as readonly { field: string; message: string }[],
    };

    let body: object;
    let status: number;
    if (error instanceof z.ZodError) {
      status = 400;
      body = {
        type: 'validation-error',
        title: 'Invalid request',
        status,
        code: 'VALIDATION_ERROR',
        detail: 'One or more request fields are invalid.',
        ...base,
        errors: error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      };
    } else if (error instanceof CatalogConflictError) {
      status = 409;
      body = {
        type: 'catalog-conflict',
        title: 'Catalog conflict',
        status,
        code: error.code,
        detail: 'The requested catalog change conflicts with existing data.',
        ...base,
      };
    } else if (error instanceof CatalogNotFoundError) {
      status = 404;
      body = {
        type: 'catalog-not-found',
        title: 'Catalog resource not found',
        status,
        code: error.code,
        detail: 'The requested catalog resource was not found.',
        ...base,
      };
    } else if (error instanceof CatalogSafetyError) {
      status = 409;
      body = {
        type: 'catalog-safety-violation',
        title: 'Catalog archive/retype safety violation',
        status,
        code: error.code,
        detail: error.message,
        ...base,
      };
    } else if (error instanceof QuoteUnavailableError) {
      status = 409;
      body = {
        type: 'availability-unavailable',
        title: 'Availability unavailable',
        status,
        code: error.code,
        detail: 'The requested room type is not available for this interval.',
        ...base,
      };
    } else if (error instanceof QuotePricingConfigurationError) {
      status = 409;
      body = {
        type: 'pricing-configuration-unavailable',
        title: 'Pricing configuration unavailable',
        status,
        code: error.code,
        detail: 'Pricing is not configured for the requested stay.',
        ...base,
      };
    } else if (error instanceof QuoteNotFoundError) {
      status = 404;
      body = {
        type: 'quote-unavailable',
        title: 'Quote unavailable',
        status,
        code: error.code,
        detail: 'The requested quote is unavailable.',
        ...base,
      };
    } else if (error instanceof QuoteExpiredError) {
      status = 409;
      body = {
        type: 'quote-expired',
        title: 'Quote expired',
        status,
        code: error.code,
        detail: 'The requested quote has expired.',
        ...base,
      };
    } else if (
      error instanceof QuoteCouponNotApplicableError ||
      error instanceof CouponRepoNotApplicableError
    ) {
      status = 409;
      body = {
        type: 'coupon-not-applicable',
        title: 'Coupon not applicable',
        status,
        code: error.code,
        detail: 'The supplied coupon is not applicable to this request.',
        ...base,
      };
    } else if (
      error instanceof QuoteCouponExpiredError ||
      error instanceof CouponRepoExpiredError
    ) {
      status = 409;
      body = {
        type: 'coupon-expired',
        title: 'Coupon expired',
        status,
        code: error.code,
        detail: 'The supplied coupon is past its validity window.',
        ...base,
      };
    } else if (
      error instanceof QuoteCouponMinimumNotMetError ||
      error instanceof CouponRepoMinimumNotMetError
    ) {
      status = 409;
      body = {
        type: 'coupon-minimum-not-met',
        title: 'Coupon minimum not met',
        status,
        code: error.code,
        detail: 'The order total is below the coupon minimum.',
        ...base,
      };
    } else if (error instanceof QuoteCouponInvalidInputError) {
      status = 400;
      body = {
        type: 'coupon-invalid-input',
        title: 'Coupon invalid input',
        status,
        code: error.code,
        detail: 'The supplied coupon input is invalid.',
        ...base,
      };
    } else if (error instanceof OtpRateLimitedError) {
      status = 429;
      body = {
        type: 'otp-rate-limited',
        title: 'OTP rate-limited',
        status,
        code: error.code,
        detail: 'Too many OTP requests; retry after the cooldown window.',
        ...base,
        ...(error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      };
    } else if (error instanceof OtpInvalidOrExpiredError) {
      status = 400;
      body = {
        type: 'otp-invalid-or-expired',
        title: 'OTP invalid or expired',
        status,
        code: error.code,
        detail: 'The provided OTP is invalid or has expired.',
        ...base,
      };
    } else if (error instanceof GuestSessionRequiredError) {
      status = 401;
      body = {
        type: 'guest-session-required',
        title: 'Guest session required',
        status,
        code: error.code,
        detail: 'A valid guest session cookie is required to access this resource.',
        ...base,
      };
    } else if (
      error instanceof GuestSessionInvalidError ||
      error instanceof GuestSessionWrongBookingError
    ) {
      status = 401;
      body = {
        type: 'guest-session-invalid',
        title: 'Guest session invalid',
        status,
        code: error.code,
        detail: 'The provided guest session is invalid or no longer authorized.',
        ...base,
      };
    } else if (error instanceof BookingNotFoundError) {
      status = 404;
      body = {
        type: 'booking-not-found',
        title: 'Booking not found',
        status,
        code: error.code,
        detail: 'The requested booking could not be found.',
        ...base,
      };
    } else if (error instanceof BookingAccessPassError) {
      status = 409;
      body = {
        type: 'booking-access-pass-invalid',
        title: 'Booking access pass unavailable',
        status,
        code: error.code,
        detail: 'A current booking access pass is not available for this booking.',
        ...base,
      };
    } else if (error instanceof CouponDeliveryError) {
      const statusByCode: Record<typeof error.code, number> = {
        COUPON_DELIVERY_IDEMPOTENCY_REQUIRED: 400,
        COUPON_DELIVERY_BOOKING_NOT_FOUND: 404,
        COUPON_DELIVERY_COUPON_UNAVAILABLE: 409,
        COUPON_DELIVERY_IDEMPOTENCY_CONFLICT: 409,
      };
      status = statusByCode[error.code];
      body = {
        type: 'coupon-delivery-failed',
        title: 'Coupon delivery request unavailable',
        status,
        code: error.code,
        detail: 'The coupon delivery request could not be queued safely.',
        ...base,
      };
    } else if (error instanceof PaymentInitiationError) {
      const statusByCode: Record<typeof error.code, number> = {
        PAYMENT_IDEMPOTENCY_REQUIRED: 400,
        MOMO_DISABLED: 503,
        MOMO_INITIATION_OUTCOME_UNKNOWN: 503,
        MOMO_INITIATION_REJECTED: 409,
        VNPAY_DISABLED: 503,
        VNPAY_INITIATION_REJECTED: 409,
      };
      status = statusByCode[error.code];
      body = {
        type: 'payment-initiation-failed',
        title: 'Payment initiation unavailable',
        status,
        code: error.code,
        detail: 'The payment attempt could not be initiated safely.',
        ...base,
      };
    } else if (error instanceof PaymentProviderSettingsError) {
      status = error.code === 'PAYMENT_PROVIDER_NOT_FOUND' ? 404 : 409;
      body = {
        type: 'payment-provider-settings-failed',
        title: 'Payment provider settings unavailable',
        status,
        code: error.code,
        detail:
          error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
            ? 'This provider cannot be enabled until server configuration is complete.'
            : 'The requested payment provider settings are unavailable.',
        ...base,
      };
    } else if (error instanceof BookingHoldError) {
      const statusByCode: Record<typeof error.code, number> = {
        QUOTE_NOT_FOUND: 404,
        QUOTE_EXPIRED: 409,
        QUOTE_ALREADY_USED: 409,
        ROOM_TYPE_UNAVAILABLE: 409,
        ALLOCATION_BUSY: 409,
        STALE_HOLD_CLEANUP_RETRY: 503,
        COUPON_REQUOTE_REQUIRED: 409,
        COUPON_HOLD_WINDOW_INCOMPATIBLE: 409,
        COUPON_MINIMUM_NOT_MET: 409,
        COUPON_LIMIT_REACHED: 409,
        COUPON_CUSTOMER_LIMIT_REACHED: 409,
        COUPON_EXPIRED: 409,
        INTERNAL_ERROR: 500,
      };
      status = statusByCode[error.code];
      body = {
        type: `booking-hold-${error.code.toLowerCase().replace(/_/g, '-')}`,
        title: 'Booking HOLD could not be created',
        status,
        code: error.code,
        detail: error.message,
        ...base,
      };
    } else if (error instanceof CustomerSessionRequiredError) {
      status = 401;
      body = {
        type: 'customer-session-required',
        title: 'Customer session required',
        status,
        code: error.name,
        detail: 'A valid CUSTOMER session is required to access this resource.',
        ...base,
      };
    } else if (error instanceof CustomerDisabledError) {
      status = 403;
      body = {
        type: 'customer-disabled',
        title: 'Customer disabled',
        status,
        code: error.name,
        detail: 'The CUSTOMER account is disabled and cannot use this resource.',
        ...base,
      };
    } else if (error instanceof BookingTransitionError) {
      status = 409;
      body = {
        type: 'booking-transition-not-allowed',
        title: 'Booking transition not allowed',
        status,
        code: error.code,
        detail: error.message,
        ...base,
      };
    } else if (error instanceof NoShowBeforeCheckInError) {
      status = 409;
      body = {
        type: 'booking-no-show-before-check-in',
        title: 'No-show before check-in',
        status,
        code: error.code,
        detail: error.message,
        ...base,
      };
    } else if (error instanceof OperationalReviewNotFoundError) {
      status = 404;
      body = {
        type: 'operational-review-not-found',
        title: 'Operational review not found',
        status,
        code: error.code,
        detail: error.message,
        ...base,
      };
    } else if (error instanceof OperationalReviewAlreadyResolvedError) {
      status = 409;
      body = {
        type: 'operational-review-already-resolved',
        title: 'Operational review already resolved',
        status,
        code: error.code,
        detail: error.message,
        ...base,
      };
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      body = {
        type: 'http-error',
        title:
          status === 401
            ? 'Authentication required'
            : status === 403
              ? 'Permission denied'
              : 'Invalid request',
        status,
        code: httpCode(error),
        detail: 'The request was not permitted.',
        ...base,
      };
    } else {
      status = 500;
      logger.error(
        {
          requestId: request.id,
          errorType: error instanceof Error ? error.name : typeof error,
        },
        'Unhandled API failure',
      );
      body = {
        type: 'internal-error',
        title: 'Internal server error',
        status,
        code: 'INTERNAL_ERROR',
        detail: 'The request could not be completed.',
        ...base,
      };
    }

    reply.status(status).type('application/problem+json').send(body);
  }
}
