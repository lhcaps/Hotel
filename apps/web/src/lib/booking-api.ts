import type {
  BookingDetailResponse,
  BookingAccessPassResponse,
  CustomerAlterationPreview,
  CustomerAlterationPreviewRequest,
  CustomerCancellationPreview,
  CustomerCancellationResponse,
  BookingHoldResponse,
  BookingHoldStatusRequest,
  BookingHoldStatusResponse,
  CreateBookingHoldRequest,
  GuestAccessOtpRequest,
  GuestAccessOtpRequestResponse,
  GuestAccessOtpVerify,
  GuestAccessOtpVerifyResponse,
  GuestLogoutResponse,
  PaymentStatusResponse,
  ProblemDetails,
} from '@room/contracts';

export class BookingApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;

  public constructor(
    public readonly problem: ProblemDetails,
    status: number,
  ) {
    super(problem.detail ?? problem.title ?? 'Booking request failed');
    this.status = status;
    this.code = problem['code'];
  }
}

export interface BookingApiRequestOptions {
  readonly signal?: AbortSignal;
}

export interface PublicPaymentProvider {
  readonly provider: 'MOMO' | 'VNPAY';
  readonly displayName: string;
  readonly displayOrder: number;
  readonly checkoutExpiryMinutes: number;
  readonly maintenanceMessage: string | null;
  readonly enabled: boolean;
  readonly unavailableReason: 'CONFIGURATION_REQUIRED' | 'PROPERTY_DISABLED' | 'MAINTENANCE' | null;
  readonly environment?: 'sandbox' | 'production' | undefined;
}

export interface PaymentInitiationResponse {
  readonly paymentId: string;
  readonly paymentAttemptId: string;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly status: 'PENDING';
  readonly redirectUrl: string;
  readonly expiresAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProvider(value: unknown): value is 'MOMO' | 'VNPAY' {
  return value === 'MOMO' || value === 'VNPAY';
}

function isPaymentAvailability(value: unknown): value is PublicPaymentProvider {
  if (!isRecord(value)) return false;
  const unavailableReason = value.unavailableReason;
  return (
    isProvider(value.provider) &&
    typeof value.displayName === 'string' &&
    value.displayName.length > 0 &&
    typeof value.displayOrder === 'number' &&
    Number.isInteger(value.displayOrder) &&
    value.displayOrder >= 0 &&
    typeof value.checkoutExpiryMinutes === 'number' &&
    Number.isInteger(value.checkoutExpiryMinutes) &&
    value.checkoutExpiryMinutes >= 1 &&
    value.checkoutExpiryMinutes <= 60 &&
    (value.maintenanceMessage === null || typeof value.maintenanceMessage === 'string') &&
    typeof value.enabled === 'boolean' &&
    (unavailableReason === null ||
      unavailableReason === 'CONFIGURATION_REQUIRED' ||
      unavailableReason === 'PROPERTY_DISABLED' ||
      unavailableReason === 'MAINTENANCE') &&
    (value.environment === undefined ||
      value.environment === 'sandbox' ||
      value.environment === 'production')
  );
}

function parsePaymentProviders(value: unknown): readonly PublicPaymentProvider[] {
  if (!Array.isArray(value) || !value.every(isPaymentAvailability)) {
    throw new Error('Invalid payment provider availability response');
  }
  return value;
}

function isPaymentInitiation(
  value: unknown,
  provider: 'MOMO' | 'VNPAY',
): value is PaymentInitiationResponse {
  if (!isRecord(value)) return false;
  if (
    typeof value.paymentId !== 'string' ||
    typeof value.paymentAttemptId !== 'string' ||
    value.provider !== provider ||
    value.status !== 'PENDING' ||
    typeof value.redirectUrl !== 'string' ||
    typeof value.expiresAt !== 'string'
  ) {
    return false;
  }
  try {
    new URL(value.redirectUrl);
    return Number.isFinite(Date.parse(value.expiresAt));
  } catch {
    return false;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  requestOptions: BookingApiRequestOptions = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl === undefined) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  }
  const init: RequestInit = {
    credentials: 'include',
    ...options,
    headers: { accept: 'application/json', ...options.headers },
  };
  if (requestOptions.signal !== undefined) {
    init.signal = requestOptions.signal;
  }
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    let problem: ProblemDetails;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      throw new BookingApiError(
        {
          type: 'about:blank',
          title: response.statusText || 'Booking request failed',
          status: response.status,
          code: 'UNKNOWN_ERROR',
          detail: response.statusText || 'Booking request failed',
          requestId: 'unavailable',
          errors: [],
        },
        response.status,
      );
    }
    throw new BookingApiError(problem, response.status);
  }
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

function postJson<TResponse, TBody>(
  path: string,
  body: TBody,
  requestOptions: BookingApiRequestOptions = {},
): Promise<TResponse> {
  return request<TResponse>(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    requestOptions,
  );
}

export const bookingApi = {
  listPaymentProviders(
    options?: BookingApiRequestOptions,
  ): Promise<readonly PublicPaymentProvider[]> {
    return request<unknown>('/public/payment-providers', { method: 'GET' }, options).then(
      parsePaymentProviders,
    );
  },

  initiatePayment(
    bookingCode: string,
    provider: 'MOMO' | 'VNPAY',
    idempotencyKey: string,
    options?: BookingApiRequestOptions,
  ): Promise<PaymentInitiationResponse> {
    return request<unknown>(
      `/public/bookings/${encodeURIComponent(bookingCode)}/payments/${provider.toLowerCase()}/attempts`,
      { method: 'POST', headers: { 'idempotency-key': idempotencyKey } },
      options,
    ).then((body) => {
      if (!isPaymentInitiation(body, provider)) {
        throw new Error('Invalid payment initiation response');
      }
      return body;
    });
  },

  initiateCustomerPayment(
    bookingCode: string,
    provider: 'MOMO' | 'VNPAY',
    idempotencyKey: string,
    options?: BookingApiRequestOptions,
  ): Promise<PaymentInitiationResponse> {
    return request<unknown>(
      `/customer/bookings/${encodeURIComponent(bookingCode)}/payments/${provider.toLowerCase()}/attempts`,
      { method: 'POST', headers: { 'idempotency-key': idempotencyKey } },
      options,
    ).then((body) => {
      if (!isPaymentInitiation(body, provider)) {
        throw new Error('Invalid payment initiation response');
      }
      return body;
    });
  },
  createBookingHold(
    quoteId: string,
    body: CreateBookingHoldRequest,
    options?: BookingApiRequestOptions,
  ): Promise<BookingHoldResponse> {
    return postJson<BookingHoldResponse, CreateBookingHoldRequest>(
      `/public/quotes/${encodeURIComponent(quoteId)}/bookings`,
      body,
      options,
    );
  },

  getBookingHoldStatus(
    body: BookingHoldStatusRequest,
    options?: BookingApiRequestOptions,
  ): Promise<BookingHoldStatusResponse> {
    return postJson<BookingHoldStatusResponse, BookingHoldStatusRequest>(
      '/public/booking-holds/status',
      body,
      options,
    );
  },

  requestGuestOtp(
    body: GuestAccessOtpRequest,
    options?: BookingApiRequestOptions,
  ): Promise<GuestAccessOtpRequestResponse> {
    return postJson<GuestAccessOtpRequestResponse, GuestAccessOtpRequest>(
      '/public/guest-access/otp/request',
      body,
      options,
    );
  },

  verifyGuestOtp(
    body: GuestAccessOtpVerify,
    options?: BookingApiRequestOptions,
  ): Promise<GuestAccessOtpVerifyResponse> {
    return postJson<GuestAccessOtpVerifyResponse, GuestAccessOtpVerify>(
      '/public/guest-access/otp/verify',
      body,
      options,
    );
  },

  getGuestBooking(
    bookingCode: string,
    options?: BookingApiRequestOptions,
  ): Promise<BookingDetailResponse> {
    return request<BookingDetailResponse>(
      `/public/bookings/${encodeURIComponent(bookingCode)}`,
      { method: 'GET' },
      options,
    );
  },

  getBookingAccessPass(
    bookingCode: string,
    options?: BookingApiRequestOptions,
  ): Promise<BookingAccessPassResponse> {
    return request<BookingAccessPassResponse>(
      `/public/bookings/${encodeURIComponent(bookingCode)}/access-pass`,
      { method: 'GET' },
      options,
    );
  },

  getCustomerBookingAccessPass(
    bookingCode: string,
    options?: BookingApiRequestOptions,
  ): Promise<BookingAccessPassResponse> {
    return request<BookingAccessPassResponse>(
      `/customer/bookings/${encodeURIComponent(bookingCode)}/access-pass`,
      { method: 'GET' },
      options,
    );
  },

  getCustomerCancellationPreview(
    bookingCode: string,
    options?: BookingApiRequestOptions,
  ): Promise<CustomerCancellationPreview> {
    return postJson<CustomerCancellationPreview, Record<string, never>>(
      `/customer/bookings/${encodeURIComponent(bookingCode)}/cancellation-preview`,
      {},
      options,
    );
  },

  cancelCustomerBooking(
    bookingCode: string,
    reason: string,
    idempotencyKey: string,
    options?: BookingApiRequestOptions,
  ): Promise<CustomerCancellationResponse> {
    return request<CustomerCancellationResponse>(
      `/customer/bookings/${encodeURIComponent(bookingCode)}/cancel`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ reason }),
      },
      options,
    );
  },

  getCustomerAlterationPreview(
    bookingCode: string,
    body: CustomerAlterationPreviewRequest,
    options?: BookingApiRequestOptions,
  ): Promise<CustomerAlterationPreview> {
    return postJson<CustomerAlterationPreview, CustomerAlterationPreviewRequest>(
      `/customer/bookings/${encodeURIComponent(bookingCode)}/alteration-preview`,
      body,
      options,
    );
  },

  getPaymentStatus(
    bookingCode: string,
    options?: BookingApiRequestOptions,
  ): Promise<PaymentStatusResponse> {
    return request<PaymentStatusResponse>(
      `/public/bookings/${encodeURIComponent(bookingCode)}/payment`,
      { method: 'GET' },
      options,
    );
  },

  getCustomerPaymentStatus(
    bookingCode: string,
    options?: BookingApiRequestOptions,
  ): Promise<PaymentStatusResponse> {
    return request<PaymentStatusResponse>(
      `/customer/bookings/${encodeURIComponent(bookingCode)}/payment`,
      { method: 'GET' },
      options,
    );
  },

  logoutGuestAccess(options?: BookingApiRequestOptions): Promise<GuestLogoutResponse> {
    return postJson<GuestLogoutResponse, Record<string, never>>(
      '/public/guest-access/logout',
      {},
      options,
    );
  },
};
