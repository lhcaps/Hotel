import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { ZodType } from '../packages/contracts/src/index.js';

interface NormalizedErrno {
  readonly code?: string;
}

import {
  availabilityOfferRequestSchema,
  availabilityOfferResponseSchema,
  availabilitySearchRequestSchema,
  availabilitySearchResponseSchema,
  createQuoteRequestSchema,
  quoteSchema,
  z,
  bookingHoldResponseSchema,
  createBookingHoldRequestSchema,
  guestAccessOtpRequestSchema,
  guestAccessOtpRequestResponseSchema,
  guestAccessOtpVerifySchema,
  guestAccessOtpVerifyResponseSchema,
  bookingDetailResponseSchema,
  bookingAccessPassResponseSchema,
  bookingHoldStatusRequestSchema,
  bookingHoldStatusResponseSchema,
  guestLogoutResponseSchema,
  momoPaymentInitiationResponseSchema,
  paymentProviderAvailabilitySchema,
  paymentStatusResponseSchema,
  vnpayPaymentInitiationResponseSchema,
  problemDetailsSchema,
  recommendationRequestSchema,
  recommendationResponseSchema,
  publicRoomCatalogResponseSchema,
  nearbyAvailabilityRequestSchema,
  nearbyAvailabilityResponseSchema,
} from '../packages/contracts/src/index.js';

const artifactPath = resolve(import.meta.dirname, '../docs/openapi/public-v1.json');
const jsonSchema = (schema: ZodType) => z.toJSONSchema(schema, { io: 'input' });

const document = {
  openapi: '3.1.1',
  info: {
    title: 'Room Management Public API',
    version: '1.0.0',
    description:
      'Server-authoritative public availability, quotes, booking HOLDs, OTP verification and guest access. Booking-detail and logout use HttpOnly session cookies; all other routes accept no credentials.',
  },
  paths: {
    '/api/v1/public/room-types': {
      get: {
        operationId: 'listPublicRoomTypes',
        responses: {
          '200': {
            description:
              'Active public room types with customer-safe descriptions, capacity and amenities. No physical-room or operational facts are exposed.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PublicRoomCatalogResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/availability/search': {
      post: {
        operationId: 'searchAvailability',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AvailabilitySearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Available room types only; no physical-room identifiers are exposed.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AvailabilitySearchResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
        },
      },
    },
    '/api/v1/public/availability/nearby': {
      post: {
        operationId: 'searchNearbyAvailability',
        description:
          'Bounded server-orchestrated nearby availability search. Returns shifted check-in candidates within `expandMinutes` (max 120) for the same active property when the requested interval has limited supply. Read-only; never creates quotes, bookings, HOLDs, coupon reservations or any persistent state.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NearbyAvailabilityRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Available nearby candidates ordered by absolute shift, earlier/later tie-rule, offer amount, plan code and stable room-type id. No physical-room identifiers, housekeeping details or maintenance reasons are exposed.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NearbyAvailabilityResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
        },
      },
    },
    '/api/v1/quotes/offers': {
      post: {
        operationId: 'listEligibleQuoteOffers',
        description:
          'Read-only server-computed eligible base plans for a room type and interval. Does not create a quote, HOLD, booking, or payment.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AvailabilityOfferRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Active, price-complete eligible plan offers only; no physical-room identities.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AvailabilityOfferResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
        },
      },
    },
    '/api/v1/quotes': {
      post: {
        operationId: 'createQuote',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateQuoteRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Server-calculated, immutable fifteen-minute quote snapshot.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Quote' } } },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
          '409': { $ref: '#/components/responses/QuoteCreationUnavailable' },
        },
      },
    },
    '/api/v1/quotes/{id}': {
      get: {
        operationId: 'getQuote',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Unexpired immutable quote snapshot.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Quote' } } },
          },
          '404': { $ref: '#/components/responses/QuoteUnavailable' },
          '409': { $ref: '#/components/responses/QuoteExpired' },
        },
      },
    },
    '/api/v1/recommendations/stay-times': {
      post: {
        operationId: 'searchStayTimeRecommendations',
        description:
          'Phase 8B advisory flexible-time recommendations. The response is non-reserving; the customer must explicitly run a normal quote to commit.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RecommendationRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Advisory recommendation set. Always returns the exact-result pricing breakdown plus zero-to-three strictly cheaper, available alternatives.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecommendationResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
          '409': { $ref: '#/components/responses/QuoteCreationUnavailable' },
        },
      },
    },
    '/api/v1/public/quotes/{quoteId}/bookings': {
      post: {
        operationId: 'createBookingHold',
        parameters: [
          {
            name: 'quoteId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBookingHoldRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Booking HOLD created. Server-calculated amount, status and expiry.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BookingHoldResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
          '404': { $ref: '#/components/responses/QuoteUnavailable' },
          '409': { $ref: '#/components/responses/BookingHoldConflict' },
          '503': { $ref: '#/components/responses/BookingHoldCleanupRetry' },
        },
      },
    },
    '/api/v1/public/guest-access/otp/request': {
      post: {
        operationId: 'requestGuestAccessOtp',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GuestAccessOtpRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'OTP challenge issued. Identical envelope for real and decoy paths; rate limits apply.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuestAccessOtpRequestResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
          '429': { $ref: '#/components/responses/OtpRateLimited' },
        },
      },
    },
    '/api/v1/public/guest-access/otp/verify': {
      post: {
        operationId: 'verifyGuestAccessOtp',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GuestAccessOtpVerify' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'OTP verified. Sets the rm_guest_session_v1 HttpOnly cookie and returns a safe envelope.',
            headers: {
              'Set-Cookie': {
                description: 'HttpOnly SameSite=Lax cookie named rm_guest_session_v1.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuestAccessOtpVerifyResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/OtpInvalidOrExpired' },
          '429': { $ref: '#/components/responses/OtpRateLimited' },
        },
      },
    },
    '/api/v1/public/bookings/{bookingCode}': {
      get: {
        operationId: 'getPublicBooking',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'bookingCode',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[A-Z0-9-]{4,32}$' },
          },
        ],
        responses: {
          '200': {
            description:
              'Booking detail with masked contact. Contact is masked regardless of session scope.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BookingDetailResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/GuestSessionRequired' },
          '404': { $ref: '#/components/responses/BookingNotFound' },
        },
      },
    },
    '/api/v1/public/bookings/{bookingCode}/access-pass': {
      get: {
        operationId: 'getPublicBookingAccessPass',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'bookingCode',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[A-Z0-9-]{4,32}$' },
          },
        ],
        responses: {
          '200': {
            description: 'A signed, time-bounded booking access-pass SVG for a confirmed booking.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BookingAccessPassResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/GuestSessionRequired' },
          '404': { $ref: '#/components/responses/BookingNotFound' },
          '409': { $ref: '#/components/responses/BookingAccessPassInvalid' },
        },
      },
    },
    '/api/v1/public/bookings/{bookingCode}/payments/momo/attempts': {
      post: {
        operationId: 'initiateMomoPayment',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'bookingCode',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[A-Z0-9-]{4,32}$' },
          },
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 200 },
          },
        ],
        responses: {
          '200': {
            description: 'Server-authoritative MoMo checkout handoff for the booking HOLD.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MomoPaymentInitiationResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/GuestSessionRequired' },
          '409': { $ref: '#/components/responses/PaymentInitiationConflict' },
        },
      },
    },
    '/api/v1/public/bookings/{bookingCode}/payments/vnpay/attempts': {
      post: {
        operationId: 'initiateVnpayPayment',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'bookingCode', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 200 },
          },
        ],
        responses: {
          '200': {
            description: 'Server-authoritative VNPAY checkout handoff.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VnpayPaymentInitiationResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/GuestSessionRequired' },
          '409': { $ref: '#/components/responses/PaymentInitiationConflict' },
        },
      },
    },
    '/api/v1/public/provider-readiness': {
      get: {
        operationId: 'getPublicProviderReadiness',
        responses: {
          '200': {
            description: 'Non-secret server-derived provider readiness for customer actions.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['google'],
                  properties: {
                    google: {
                      type: 'object',
                      required: ['enabled', 'unavailableReason'],
                      properties: {
                        enabled: { type: 'boolean' },
                        unavailableReason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/public/payment-providers': {
      get: {
        operationId: 'listPaymentProviders',
        responses: {
          '200': {
            description:
              'All property payment providers with server-derived safe enabled state and availability reason.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PaymentProviderAvailability' },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/public/bookings/{bookingCode}/payment': {
      get: {
        operationId: 'getPaymentStatus',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'bookingCode', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description:
              'Authoritative persisted payment status; browser return parameters have no authority.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentStatusResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/GuestSessionRequired' },
        },
      },
    },
    '/api/v1/webhooks/vnpay': {
      get: {
        operationId: 'receiveVnpayIpn',
        description:
          'Signed provider IPN. Raw duplicate query keys are rejected before settlement.',
        responses: { '200': { description: 'VNPAY RspCode acknowledgement.' } },
      },
    },
    '/api/v1/payments/providers/vnpay/return': {
      get: {
        operationId: 'readVnpayPaymentReturn',
        description: 'Read-only browser return boundary. Query parameters do not settle a payment.',
        responses: { '204': { description: 'Return received without state mutation.' } },
      },
    },
    '/api/v1/webhooks/momo': {
      post: {
        operationId: 'receiveMomoIpn',
        description:
          'Provider-to-provider signed IPN. This endpoint never accepts browser settlement authority.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object', additionalProperties: true } },
          },
        },
        responses: {
          '204': { description: 'IPN acknowledged; invalid payloads are safely rejected.' },
        },
      },
    },
    '/api/v1/payments/providers/momo/return': {
      get: {
        operationId: 'readMomoPaymentReturn',
        description: 'Read-only browser return boundary. Query parameters do not settle a payment.',
        responses: { '204': { description: 'Return received without state mutation.' } },
      },
    },
    '/api/v1/public/booking-holds/status': {
      post: {
        operationId: 'getBookingHoldStatus',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BookingHoldStatusRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Returns HOLD, EXPIRED or UNKNOWN — never an error code for known inputs.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BookingHoldStatusResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidRequest' },
        },
      },
    },
    '/api/v1/public/guest-access/logout': {
      post: {
        operationId: 'logoutGuestAccess',
        responses: {
          '200': {
            description:
              'Always returns loggedOutAt. Clears the rm_guest_session_v1 cookie via Set-Cookie Max-Age=0.',
            headers: {
              'Set-Cookie': {
                description: 'rm_guest_session_v1 cleared with Max-Age=0.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GuestLogoutResponse' } },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'rm_guest_session_v1',
        description:
          'HttpOnly, SameSite=Lax, Secure-in-production guest session cookie. Raw token is never returned in any JSON body.',
      },
    },
    schemas: {
      AvailabilityOfferRequest: jsonSchema(availabilityOfferRequestSchema),
      AvailabilityOfferResponse: jsonSchema(availabilityOfferResponseSchema),
      AvailabilitySearchRequest: jsonSchema(availabilitySearchRequestSchema),
      AvailabilitySearchResponse: jsonSchema(availabilitySearchResponseSchema),
      CreateQuoteRequest: jsonSchema(createQuoteRequestSchema),
      Quote: jsonSchema(quoteSchema),
      CreateBookingHoldRequest: jsonSchema(createBookingHoldRequestSchema),
      BookingHoldResponse: jsonSchema(bookingHoldResponseSchema),
      GuestAccessOtpRequest: jsonSchema(guestAccessOtpRequestSchema),
      GuestAccessOtpRequestResponse: jsonSchema(guestAccessOtpRequestResponseSchema),
      GuestAccessOtpVerify: jsonSchema(guestAccessOtpVerifySchema),
      GuestAccessOtpVerifyResponse: jsonSchema(guestAccessOtpVerifyResponseSchema),
      BookingDetailResponse: jsonSchema(bookingDetailResponseSchema),
      BookingAccessPassResponse: jsonSchema(bookingAccessPassResponseSchema),
      BookingHoldStatusRequest: jsonSchema(bookingHoldStatusRequestSchema),
      BookingHoldStatusResponse: jsonSchema(bookingHoldStatusResponseSchema),
      GuestLogoutResponse: jsonSchema(guestLogoutResponseSchema),
      MomoPaymentInitiationResponse: jsonSchema(momoPaymentInitiationResponseSchema),
      VnpayPaymentInitiationResponse: jsonSchema(vnpayPaymentInitiationResponseSchema),
      PaymentProviderAvailability: jsonSchema(paymentProviderAvailabilitySchema),
      PaymentStatusResponse: jsonSchema(paymentStatusResponseSchema),
      ProblemDetails: jsonSchema(problemDetailsSchema),
      RecommendationRequest: jsonSchema(recommendationRequestSchema),
      RecommendationResponse: jsonSchema(recommendationResponseSchema),
      PublicRoomCatalogResponse: jsonSchema(publicRoomCatalogResponseSchema),
      NearbyAvailabilityRequest: jsonSchema(nearbyAvailabilityRequestSchema),
      NearbyAvailabilityResponse: jsonSchema(nearbyAvailabilityResponseSchema),
    },
    responses: {
      InvalidRequest: {
        description: 'Request body or parameters failed validation.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      QuoteCreationUnavailable: {
        description: 'The room is unavailable or pricing is not configured for the requested stay.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      QuoteUnavailable: {
        description: 'The requested quote does not exist (RFC 7807 type=quote-unavailable).',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      QuoteExpired: {
        description: 'The requested quote has expired (RFC 7807 type=quote-expired).',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      BookingHoldConflict: {
        description:
          'Booking HOLD could not be created (room unavailable, allocation busy, quote already used or expired). RFC 7807 type is booking-hold-{code}.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      BookingHoldCleanupRetry: {
        description:
          'Booking HOLD cleanup hit its safety bound and the request should be retried later. RFC 7807 type=booking-hold-stale-hold-cleanup-retry.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      OtpInvalidOrExpired: {
        description: 'The provided OTP is invalid or expired.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      OtpRateLimited: {
        description:
          'OTP rate-limited (RFC 7807 type=otp-rate-limited). The Retry-After header and problem-detail body carry retryAfterSeconds.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      GuestSessionRequired: {
        description:
          'No rm_guest_session_v1 cookie was presented (RFC 7807 type=guest-session-required).',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      BookingNotFound: {
        description: 'The requested booking could not be found (RFC 7807 type=booking-not-found).',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      BookingAccessPassInvalid: {
        description:
          'The booking access pass is unavailable because the booking is not confirmed or the pass was revoked.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      PaymentInitiationConflict: {
        description: 'The booking cannot start a MoMo attempt in its current payment state.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
    },
  },
} as const;

const mode = process.argv[2];
const prettierOptions = await resolveConfig(artifactPath);
const expected = await format(JSON.stringify(document), {
  ...prettierOptions,
  filepath: artifactPath,
  parser: 'json',
});

if (mode === '--write') {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, expected, 'utf8');
  process.stdout.write(`Generated ${artifactPath}\n`);
} else if (mode === '--check') {
  let actual: string | undefined;
  try {
    actual = await readFile(artifactPath, 'utf8');
  } catch (error: unknown) {
    if ((error as NormalizedErrno).code !== 'ENOENT') throw error;
  }
  if (actual !== expected) {
    process.stderr.write('Public OpenAPI artifact is out of date. Run pnpm generate:openapi.\n');
    process.exitCode = 1;
  }
} else {
  throw new Error('Expected --write or --check.');
}
