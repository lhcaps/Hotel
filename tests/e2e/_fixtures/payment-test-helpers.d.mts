// Type declarations for payment-test-helpers.mjs
// Inspect the actual implementation before editing; keep in sync.

export interface SimulatorCounts {
  readonly counts: {
    readonly momoIpnAttempts: number;
    readonly momoQueryCount: number;
    readonly momoCreateCount: number;
    readonly vnpayIpnAttempts: number;
    readonly vnpayQueryCount: number;
    readonly vnpayCreateCount: number;
    readonly defaultBackRedirectBase?: string;
  };
}

export interface SimulatorModeOptions {
  readonly reset?: boolean;
  readonly duplicateIpns?: boolean;
  readonly backRedirectUrl?: string;
  readonly redirectDelayMs?: number;
}

export interface SimulatorControlResponse {
  readonly ok: boolean;
  readonly provider: string;
  readonly state: SimulatorModeOptions;
  readonly counts: SimulatorCounts['counts'];
}

export interface QuoteBody {
  readonly id: string;
  readonly roomTypeId: string;
  readonly pricing?: {
    readonly totalAmountVnd: number;
    readonly currency: string;
  };
}

export interface BookingHoldResult {
  readonly bookingCode: string;
  readonly quoteId: string;
  readonly guestSessionCookie: string;
  readonly finalAmountVnd: number | undefined;
  readonly contactEmail: string;
}

export interface PaymentStatusResult {
  readonly status: number;
  readonly body: {
    readonly provider?: string;
    readonly paymentStatus?: string;
    readonly attemptStatus?: string;
    readonly bookingStatus?: string;
    readonly amountVnd?: number;
    readonly currency?: string;
    readonly createdAt?: string;
    readonly updatedAt?: string;
    readonly completedAt?: string | null;
    readonly reviewRequired?: boolean;
    readonly customerMessage?: string | null;
    readonly amount?: number;
    readonly transId?: string;
    readonly orderId?: string;
  };
}

export interface PaymentAttemptResult {
  readonly redirectUrl: string;
  readonly idempotencyKey: string;
  readonly orderId?: string;
}

export interface PaymentInitiationResponse {
  readonly redirectUrl: string;
  readonly idempotencyKey: string;
  readonly orderId?: string;
}

export interface BookingSearchInterval {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
}

export function getApiBaseUrl(): string;
export function getSimulatorBaseUrl(): string;
export function getWebBaseUrl(): string;
export function futureLunchIso(): BookingSearchInterval;
export function createQuote(apiBase?: string): Promise<QuoteBody>;
export function createBookingHold(apiBase?: string): Promise<BookingHoldResult>;
export function readPaymentStatus(
  bookingCode: string,
  guestSessionCookie: string,
  apiBase?: string,
): Promise<PaymentStatusResult>;
export function initiateMomoPayment(
  bookingCode: string,
  guestSessionCookie: string,
  apiBase?: string,
): Promise<PaymentAttemptResult>;
export function initiateVnpayPayment(
  bookingCode: string,
  guestSessionCookie: string,
  apiBase?: string,
): Promise<PaymentAttemptResult>;
export function setSimulatorMode(
  provider: string,
  mode: string,
  options?: SimulatorModeOptions,
): Promise<SimulatorControlResponse>;
export function readSimulatorCounts(): Promise<SimulatorCounts>;
export function adminLogin(apiBase?: string): Promise<string>;
export function adminListPayments(
  query?: Record<string, string>,
  apiBase?: string,
): Promise<unknown>;
export function adminGetPayment(paymentId: string, apiBase?: string): Promise<unknown>;

export function waitFor<T>(
  condition: () => Promise<T> | T,
  options?: { readonly timeoutMs?: number; readonly intervalMs?: number },
): Promise<T>;
