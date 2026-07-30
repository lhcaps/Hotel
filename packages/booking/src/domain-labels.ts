/**
 * Domain-separated digest labels for Phase 5 booking primitives.
 *
 * These labels are the single source of truth for every HMAC-SHA256
 * digests Phase 5 writes to PostgreSQL. The booking primitives
 * (`@room/booking`) use the same labels, so the worker and the API must
 * share this module rather than redefining their own constants.
 */

export const DIGEST_DOMAIN_LABELS = {
  emailLookup: 'room-management/email-lookup/v1',
  challengeRef: 'room-management/challenge-ref/v1',
  ipRateLimit: 'room-management/ip-rate-limit/v1',
  guestSession: 'room-management/guest-session/v1',
  otp: 'room-management/otp/v1',
} as const;

export type DigestDomainLabel =
  (typeof DIGEST_DOMAIN_LABELS)[keyof typeof DIGEST_DOMAIN_LABELS];
