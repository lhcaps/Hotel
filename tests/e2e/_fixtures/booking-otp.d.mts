// Type declarations for booking-otp.mjs
// Inspect the actual implementation before editing; keep in sync.

export interface OtpHold {
  readonly bookingCode: string;
  readonly email: string;
  readonly quoteId: string;
  readonly finalAmountVnd?: number;
}

export interface BookingSearchInterval {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
}

export function futureLunchIso(offsetMinutes?: number): BookingSearchInterval;
export function waitForVerificationOtp(recipientEmail: string, timeoutMs?: number): Promise<string>;
export function createHoldsForUi(options?: {
  readonly count?: number;
}): Promise<readonly OtpHold[]>;
export function fetchOtpFor(hold: OtpHold): Promise<string>;
export function getDatabaseUrl(): string | undefined;
