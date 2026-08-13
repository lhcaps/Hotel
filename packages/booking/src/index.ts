/**
 * @room/booking - Phase 5 booking primitives and services
 *
 * Booking code, challenge ref, OTP, digest, contact normalization,
 * and booking HOLD creation with transactional retry.
 */

export type { RandomIndexSource } from './booking-code.js';
export { generateBookingCode, normalizeBookingCode } from './booking-code.js';

export type { DeriveChallengeRefInput, RandomBytesSource } from './challenge-ref.js';
export {
  deriveChallengeRef,
  digestChallengeRef,
  generateDecoyChallengeRef,
  normalizeChallengeRef,
} from './challenge-ref.js';

export type { OtpInput } from './otp.js';
export { deriveOtp, verifyOtp, deriveOtpForChallenge } from './otp.js';

export type { DigestInput } from './digest.js';
export { computeDigest } from './digest.js';

export type { ContactInput, NormalizedContact } from './contact.js';
export { normalizeContact, contactsAreEquivalent, maskEmailForDisplay } from './contact.js';

export { collapseWhitespace, normalizeUnicode } from './strings.js';

export {
  CANCELLATION_POLICY_CODE,
  CANCELLATION_POLICY_VERSION,
  CANCELLATION_REFUND_BASIS,
  CANCELLATION_SEVEN_DAY_SECONDS,
  CANCELLATION_THREE_DAY_SECONDS,
  createCancellationPolicySnapshot,
  evaluateCancellationPolicy,
  toCancellationPolicyDisplaySnapshot,
  type CancellationEvaluation,
  type CancellationPolicyDisplaySnapshot,
  type CancellationPolicySnapshot,
} from './cancellation-policy.js';

export { DIGEST_DOMAIN_LABELS, type DigestDomainLabel } from './domain-labels.js';

export {
  ArrivalAccessCrypto,
  ArrivalAccessCryptoError,
  deriveArrivalAccessEncryptionKey,
  type ArrivalAccessCryptoContext,
  type ArrivalAccessScope,
} from './arrival-access-crypto.js';

export {
  BookingAccessPassError,
  BookingAccessPassService,
  isAccessPassWithinArrivalWindow,
} from './booking-access-pass.js';

// Domain errors
export {
  QuoteNotFoundError,
  QuoteExpiredError,
  QuoteAlreadyUsedError,
  RoomTypeUnavailableError,
  AllocationBusyError,
  StaleHoldCleanupRetryError,
  type BookingHoldErrorCode,
} from './errors.js';

// Services
export type { CreateBookingHoldInput, BookingHoldResult } from './services/create-booking-hold.js';
export { createBookingHoldWithRetry } from './services/create-booking-hold.js';

// Repository interfaces (for testing and advanced usage)
export type { AvailabilityProbe, RoomCandidate } from './repository/availability.js';
export {
  countFreeRooms,
  countStructurallyEligibleRooms,
  findAllocatableRooms,
  findStructurallyEligibleRooms,
} from './repository/availability.js';

// Coupon primitives (Phase 6C)
export * from './coupon/index.js';

// Payment primitives (Phase 7C): provider-independent and controller-free.
export * from './payment/index.js';
