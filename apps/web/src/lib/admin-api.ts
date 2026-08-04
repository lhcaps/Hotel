import {
  availabilityOfferResponseSchema,
  availabilitySearchResponseSchema,
  nearbyAvailabilityRequestSchema,
  nearbyAvailabilityResponseSchema,
} from '@room/contracts/pricing';
import type {
  AdminMe,
  AdminAccount,
  AdminAuditEntry,
  AdminCustomerAccount,
  AdminDepartment,
  AdminOperationalReport,
  Amenity,
  MaintenanceBlock,
  PriceTier,
  ProblemDetails,
  Property,
  Quote,
  RecommendationRequest,
  RecommendationResponse,
  Room,
  RoomType,
  Coupon,
  RatePlan,
  RatePlanCreateCommand,
  RatePlanSelectionRuleCommand,
  AvailabilityOfferResponse,
  AvailabilitySearchResponse,
  NearbyAvailabilityRequest,
  NearbyAvailabilityResponse,
} from '@room/contracts';

export interface CatalogPage<T> {
  readonly page: number;
  readonly pageSize: number;
  readonly items: readonly T[];
}

export interface PaymentProviderAdmin {
  readonly provider: 'MOMO' | 'VNPAY';
  readonly configured: boolean;
  readonly environment: 'sandbox' | 'production';
  readonly enabled: boolean;
  readonly displayName: string;
  readonly displayOrder: number;
  readonly checkoutExpiryMinutes: number;
  readonly maintenanceMessage: string | null;
}

export interface PaymentProviderUpdate {
  readonly enabled?: boolean;
  readonly displayName?: string;
  readonly displayOrder?: number;
  readonly checkoutExpiryMinutes?: number;
  readonly maintenanceMessage?: string | null;
}

export class AdminApiError extends Error {
  public constructor(public readonly problem: ProblemDetails) {
    super(problem.detail);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl === undefined) throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: { accept: 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const problem = (await response.json()) as ProblemDetails;
    throw new AdminApiError(problem);
  }
  const body = await response.text();
  return (body === '' ? undefined : JSON.parse(body)) as T;
}

export const adminApi = {
  listAdminAccounts: () => request<readonly AdminAccount[]>('/admin/accounts'),
  createAdminAccount: (body: unknown) =>
    request<AdminAccount>('/admin/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  listCustomerAccounts: () => request<readonly AdminCustomerAccount[]>('/admin/customer-accounts'),
  updateAdminAccount: (id: string, body: unknown) =>
    request<AdminAccount>(`/admin/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  revokeAdminSessions: (id: string) =>
    request<{ userId: string; revokedSessions: number }>(`/admin/accounts/${id}/revoke-sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  updateCustomerAccount: (id: string, body: { status: 'ACTIVE' | 'DISABLED' }) =>
    request<AdminCustomerAccount>(`/admin/customer-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  revokeCustomerSessions: (id: string) =>
    request<{ userId: string; revokedSessions: number }>(
      `/admin/customer-accounts/${id}/revoke-sessions`,
      { method: 'POST' },
    ),
  listAdminDepartments: () => request<readonly AdminDepartment[]>('/admin/departments'),
  createAdminDepartment: (body: unknown) =>
    request<AdminDepartment>('/admin/departments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  listAdminAudit: () => request<{ items: readonly AdminAuditEntry[] }>('/admin/audit'),
  getRoomOperations: (query: { readonly from: string; readonly to: string }) =>
    request<AdminRoomOperationsResponse>(
      `/admin/room-operations?${new URLSearchParams(query).toString()}`,
    ),
  getOperationalReport: (query: {
    readonly from: string;
    readonly to: string;
    readonly bookingStatuses?: readonly string[] | undefined;
    readonly paymentStatuses?: readonly string[] | undefined;
    readonly ratePlanCodes?: readonly string[] | undefined;
    readonly roomTierCodes?: readonly string[] | undefined;
  }) => {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    for (const status of query.bookingStatuses ?? []) params.append('bookingStatuses', status);
    for (const status of query.paymentStatuses ?? []) params.append('paymentStatuses', status);
    for (const code of query.ratePlanCodes ?? []) params.append('ratePlanCodes', code);
    for (const code of query.roomTierCodes ?? []) params.append('roomTierCodes', code);
    return request<AdminOperationalReport>(`/admin/operational-report?${params.toString()}`);
  },
  listPaymentProviders: () => request<readonly PaymentProviderAdmin[]>('/admin/payment-providers'),
  updatePaymentProvider: (provider: 'MOMO' | 'VNPAY', body: PaymentProviderUpdate) =>
    request<PaymentProviderAdmin>(`/admin/payment-providers/${provider}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  listRatePlans: () => request<{ items: readonly RatePlan[] }>('/admin/rate-plans'),
  createRatePlan: (body: RatePlanCreateCommand) =>
    request<RatePlan>('/admin/rate-plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  listCoupons: (page = 1, pageSize = 100) =>
    request<{ page: number; pageSize: number; items: readonly Coupon[] }>(
      `/admin/coupons?page=${page}&pageSize=${pageSize}`,
    ),
  getCoupon: (id: string) => request<Coupon>(`/admin/coupons/${id}`),
  createCoupon: (body: unknown) =>
    request<Coupon>('/admin/coupons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  disableCoupon: (id: string) =>
    request<Coupon>(`/admin/coupons/${id}/disable`, { method: 'POST' }),

  updateRatePlanPrice: (planId: string, priceTierId: string, amountVnd: number) =>
    request<void>(`/admin/rate-plans/${planId}/prices/${priceTierId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountVnd }),
    }),
  activateRatePlan: (id: string) =>
    request<RatePlan>(`/admin/rate-plans/${id}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activate: true }),
    }),
  inactivateRatePlan: (id: string) =>
    request<RatePlan>(`/admin/rate-plans/${id}/inactivate`, { method: 'POST' }),
  updateRatePlanSelectionRule: (planId: string, body: RatePlanSelectionRuleCommand) =>
    request<RatePlan>(`/admin/rate-plans/${planId}/selection-rule`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  me: () => request<AdminMe>('/admin/me'),
  property: () => request<Property>('/admin/property'),
  updateProperty: (body: unknown) =>
    request<Property>('/admin/property', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  listPriceTiers: () => request<CatalogPage<PriceTier>>('/admin/price-tiers'),
  createPriceTier: (body: { code: string; name: string; sortOrder: number }) =>
    request<PriceTier>('/admin/price-tiers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updatePriceTier: (id: string, body: { code: string; name: string; sortOrder: number }) =>
    request<PriceTier>(`/admin/price-tiers/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  archivePriceTier: (id: string) =>
    request<PriceTier>(`/admin/price-tiers/${id}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    }),
  listRoomTypes: () => request<CatalogPage<RoomType>>('/admin/room-types'),
  createRoomType: (body: {
    priceTierId: string;
    code: string;
    name: string;
    maxAdults: number;
    maxChildren: number;
    maxOccupancy: number;
  }) =>
    request<RoomType>('/admin/room-types', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateRoomType: (
    id: string,
    body: {
      name?: string;
      description?: string | null;
      maxAdults?: number;
      maxChildren?: number;
      maxOccupancy?: number;
      priceTierId?: string;
    },
  ) =>
    request<RoomType>(`/admin/room-types/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  archiveRoomType: (id: string) =>
    request<RoomType>(`/admin/room-types/${id}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    }),
  assignAmenity: (roomTypeId: string, amenityId: string) =>
    request<void>(`/admin/room-types/${roomTypeId}/amenities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amenityId }),
    }),
  removeAmenityFromRoomType: (roomTypeId: string, amenityId: string) =>
    request<{ roomTypeId: string; amenityId: string; existed: boolean }>(
      `/admin/room-types/${roomTypeId}/amenities/${amenityId}`,
      { method: 'DELETE' },
    ),
  listAmenities: () => request<CatalogPage<Amenity>>('/admin/amenities'),
  createAmenity: (body: { code: string; name: string }) =>
    request<Amenity>('/admin/amenities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateAmenity: (id: string, body: { name: string }) =>
    request<Amenity>(`/admin/amenities/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  archiveAmenity: (id: string) =>
    request<Amenity>(`/admin/amenities/${id}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    }),
  listRooms: () => request<CatalogPage<Room>>('/admin/rooms'),
  createRoom: (body: { roomTypeId: string; roomNumber: string }) =>
    request<Room>('/admin/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  archiveRoom: (id: string) =>
    request<Room>(`/admin/rooms/${id}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    }),
  updateRoom: (id: string, body: { roomNumber?: string; roomTypeId?: string }) =>
    request<Room>(`/admin/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateRoomHousekeeping: (id: string, status: 'CLEAN' | 'DIRTY' | 'CLEANING') =>
    request<Room>(`/admin/rooms/${id}/housekeeping`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  listMaintenanceBlocks: () => request<CatalogPage<MaintenanceBlock>>('/admin/maintenance-blocks'),
  createMaintenanceBlock: (body: {
    roomId: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  }) =>
    request<MaintenanceBlock>('/admin/maintenance-blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  cancelMaintenanceBlock: (id: string) =>
    request<MaintenanceBlock>(`/admin/maintenance-blocks/${id}/cancel`, { method: 'POST' }),

  listAdminBookings: (
    query: {
      readonly page?: number;
      readonly pageSize?: number;
      readonly bookingCode?: string;
      readonly status?: string;
      readonly paymentStatus?: string;
      readonly roomTypeId?: string;
      readonly checkInFrom?: string;
      readonly checkInTo?: string;
      readonly reviewPresence?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
    if (query.bookingCode !== undefined && query.bookingCode !== '') {
      params.set('bookingCode', query.bookingCode);
    }
    if (query.status !== undefined && query.status !== '') params.set('status', query.status);
    if (query.paymentStatus !== undefined && query.paymentStatus !== '') {
      params.set('paymentStatus', query.paymentStatus);
    }
    if (query.roomTypeId !== undefined && query.roomTypeId !== '') {
      params.set('roomTypeId', query.roomTypeId);
    }
    if (query.checkInFrom !== undefined && query.checkInFrom !== '') {
      params.set('checkInFrom', query.checkInFrom);
    }
    if (query.checkInTo !== undefined && query.checkInTo !== '') {
      params.set('checkInTo', query.checkInTo);
    }
    if (query.reviewPresence !== undefined && query.reviewPresence !== '') {
      params.set('reviewPresence', query.reviewPresence);
    }
    const qs = params.toString();
    return request<{
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      items: readonly AdminBookingSummary[];
    }>(`/admin/bookings${qs === '' ? '' : `?${qs}`}`);
  },
  getAdminBooking: (bookingCode: string) =>
    request<AdminBookingDetail>(`/admin/bookings/${bookingCode}`),
  scanBookingAccessPass: (value: string) =>
    request<AdminBookingAccessPassScanResult>('/admin/booking-access-passes/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    }),
  sendAdminBookingCoupons: (
    bookingCode: string,
    couponCodes: readonly string[],
    idempotencyKey: string,
  ) =>
    request<void>(`/admin/bookings/${bookingCode}/send-coupons`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ couponCodes }),
    }),
  cancelAdminBooking: (bookingCode: string, reason: string) =>
    request<AdminBookingDetail>(`/admin/bookings/${bookingCode}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
  checkInAdminBooking: (bookingCode: string) =>
    request<AdminBookingDetail>(`/admin/bookings/${bookingCode}/check-in`, {
      method: 'POST',
    }),
  checkOutAdminBooking: (bookingCode: string) =>
    request<AdminBookingDetail>(`/admin/bookings/${bookingCode}/check-out`, {
      method: 'POST',
    }),
  markNoShowAdminBooking: (bookingCode: string, reason: string) =>
    request<AdminBookingDetail>(`/admin/bookings/${bookingCode}/no-show`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
  listOperationalReviews: (
    query: {
      readonly page?: number;
      readonly pageSize?: number;
      readonly status?: 'OPEN' | 'RESOLVED';
      readonly bookingCode?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
    if (query.status !== undefined) params.set('status', query.status);
    if (query.bookingCode !== undefined && query.bookingCode !== '') {
      params.set('bookingCode', query.bookingCode);
    }
    const qs = params.toString();
    return request<{
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      items: readonly AdminOperationalReviewSummary[];
    }>(`/admin/operational-reviews${qs === '' ? '' : `?${qs}`}`);
  },
  getOperationalReview: (reviewId: string) =>
    request<AdminOperationalReviewDetail>(`/admin/operational-reviews/${reviewId}`),
  resolveOperationalReview: (reviewId: string, note: string) =>
    request<AdminOperationalReviewDetail>(`/admin/operational-reviews/${reviewId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
    }),
  listPayments: (
    query: {
      readonly page?: number;
      readonly pageSize?: number;
      readonly status?: AdminPaymentStatus | '';
      readonly provider?: AdminPaymentProvider | '';
      readonly bookingCode?: string;
      readonly needsReview?: boolean;
      readonly createdFrom?: string;
      readonly createdTo?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
    if (query.status !== undefined && query.status !== '') params.set('status', query.status);
    if (query.provider !== undefined && query.provider !== '') {
      params.set('provider', query.provider);
    }
    if (query.bookingCode !== undefined && query.bookingCode !== '') {
      params.set('bookingCode', query.bookingCode);
    }
    if (query.needsReview !== undefined) params.set('needsReview', String(query.needsReview));
    if (query.createdFrom !== undefined && query.createdFrom !== '') {
      params.set('createdFrom', query.createdFrom);
    }
    if (query.createdTo !== undefined && query.createdTo !== '') {
      params.set('createdTo', query.createdTo);
    }
    const qs = params.toString();
    return request<{
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      items: readonly AdminPaymentSummary[];
    }>(`/admin/payments${qs === '' ? '' : `?${qs}`}`);
  },
  getPayment: (paymentId: string) => request<AdminPaymentDetail>(`/admin/payments/${paymentId}`),
  queryPaymentStatus: (paymentId: string) =>
    request<AdminPaymentStatusQueryResult>(`/admin/payments/${paymentId}/status-query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
};

export const publicApi = {
  searchAvailability: (body: unknown) =>
    request<unknown>('/availability/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((response): AvailabilitySearchResponse =>
      availabilitySearchResponseSchema.parse(response),
    ),
  searchNearbyAvailability: (body: NearbyAvailabilityRequest) =>
    request<unknown>('/public/availability/nearby', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(nearbyAvailabilityRequestSchema.parse(body)),
    }).then((response): NearbyAvailabilityResponse =>
      nearbyAvailabilityResponseSchema.parse(response),
    ),
  eligibleOffers: (body: unknown) =>
    request<unknown>('/quotes/offers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((response): AvailabilityOfferResponse =>
      availabilityOfferResponseSchema.parse(response),
    ),
  issueQuote: (body: unknown) =>
    request<{ id: string }>('/quotes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  quote: (id: string) => request<Quote>(`/quotes/${id}`),
  searchStayTimeRecommendations: (body: RecommendationRequest) =>
    request<RecommendationResponse>('/recommendations/stay-times', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
};

export type BookingStatus =
  'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';

export type PaymentStatusSummary =
  'NONE' | 'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';

export type ReviewPresence = 'OPEN' | 'RESOLVED' | 'NONE';

export interface AdminBookingSummary {
  readonly bookingCode: string;
  readonly status: BookingStatus;
  readonly guestName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly roomType: { readonly id: string; readonly code: string; readonly name: string };
  readonly room: { readonly id: string; readonly roomNumber: string } | null;
  readonly finalAmountVnd: number;
  readonly currency: string;
  readonly paymentStatus: PaymentStatusSummary;
  readonly reviewPresence: ReviewPresence;
  readonly createdAt: string;
}

export interface AdminRoomOperationsResponse {
  readonly generatedAt: string;
  readonly items: readonly {
    readonly roomId: string;
    readonly roomNumber: string;
    readonly roomConcept: string;
    readonly roomStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    readonly housekeepingStatus: 'CLEAN' | 'DIRTY' | 'CLEANING';
    readonly maintenanceState: 'ACTIVE' | 'NONE';
    readonly currentOccupancy: 'OCCUPIED' | 'VACANT';
    readonly nextBookingWindow: { readonly checkIn: string; readonly checkOut: string } | null;
    readonly freeWindows: readonly { readonly startsAt: string; readonly endsAt: string }[];
    readonly activeHousekeepingTask: {
      readonly type: 'ARRIVAL_PREP' | 'TURNOVER';
      readonly status: 'SCHEDULED' | 'DUE' | 'IN_PROGRESS';
      readonly dueAt: string;
    } | null;
    readonly bookings: readonly {
      readonly bookingCode: string;
      readonly status: BookingStatus;
      readonly checkIn: string;
      readonly checkOut: string;
    }[];
  }[];
}

export interface AdminBookingContact {
  readonly fullName: string;
  readonly emailMasked: string;
  readonly phoneMasked: string;
}

export interface AdminBookingPricing {
  readonly grossAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly finalAmountVnd: number;
  readonly currency: string;
  readonly coupon: {
    readonly code: string;
    readonly discountType: 'FIXED' | 'PERCENTAGE';
    readonly grossAmountVnd: number;
    readonly discountAmountVnd: number;
    readonly finalAmountVnd: number;
  } | null;
}

export interface AdminBookingPaymentSummary {
  readonly status: PaymentStatusSummary;
  readonly amountVnd: number;
  readonly confirmationSource: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  readonly succeededAt: string | null;
}

export interface AdminBookingTimelineEntry {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  readonly actorId: string | null;
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
}

export interface AdminOperationalReviewDetail {
  readonly reviewId: string;
  readonly bookingCode: string;
  readonly bookingStatus: BookingStatus;
  readonly category: 'PAID_CANCELLATION';
  readonly status: 'OPEN' | 'RESOLVED';
  readonly openedAt: string;
  readonly openedReason: string;
  readonly resolvedAt: string | null;
  readonly paymentStatus: PaymentStatusSummary;
  readonly amountVnd: number;
  readonly booking: {
    readonly bookingCode: string;
    readonly status: BookingStatus;
    readonly checkIn: string;
    readonly checkOut: string;
    readonly roomType: { readonly code: string; readonly name: string };
    readonly room: { readonly id: string; readonly roomNumber: string } | null;
    readonly finalAmountVnd: number;
  };
  readonly payment: AdminBookingPaymentSummary;
  readonly timeline: readonly AdminBookingTimelineEntry[];
  readonly serverTime: string;
}

export interface AdminOperationalReviewSummary {
  readonly reviewId: string;
  readonly bookingCode: string;
  readonly bookingStatus: BookingStatus;
  readonly category: 'PAID_CANCELLATION';
  readonly status: 'OPEN' | 'RESOLVED';
  readonly openedAt: string;
  readonly openedReason: string;
  readonly resolvedAt: string | null;
  readonly paymentStatus: PaymentStatusSummary;
  readonly amountVnd: number;
}

export type AdminPaymentProvider = 'MOMO' | 'VNPAY';

export type AdminPaymentStatus =
  'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';

export type AdminPaymentAttemptStatus =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVIEW_REQUIRED' | 'EXPIRED' | 'CANCELLED';

export type AdminPaymentReconciliationStatus =
  'IN_PROGRESS' | 'MATCHED' | 'MISMATCH' | 'AWAITING_REVIEW';

export interface AdminPaymentSummary {
  readonly paymentId: string;
  readonly bookingCode: string;
  readonly provider: AdminPaymentProvider | null;
  readonly status: AdminPaymentStatus;
  readonly amountVnd: number;
  readonly currency: string;
  readonly attemptCount: number;
  readonly needsReview: boolean;
  readonly reconciliationStatus: AdminPaymentReconciliationStatus;
  readonly lastEventAt: string;
  readonly createdAt: string;
}

export interface AdminPaymentAttempt {
  readonly attemptId: string;
  readonly sequence: number;
  readonly provider: AdminPaymentProvider | null;
  readonly status: AdminPaymentAttemptStatus;
  readonly amountVnd: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly failureReason: string | null;
}

export interface AdminPaymentEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly provider: AdminPaymentProvider | null;
  readonly actorType: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM' | 'PROVIDER';
  readonly occurredAt: string;
  readonly summary: string;
}

export interface AdminPaymentReconciliation {
  readonly status: AdminPaymentReconciliationStatus;
  readonly lastCheckedAt: string;
  readonly lastReconciledAt: string | null;
  readonly mismatchedFields: readonly string[];
  readonly note: string | null;
}

export interface AdminPaymentAuditEntry {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  readonly actorId: string | null;
  readonly occurredAt: string;
  readonly summary: string;
}

export interface AdminPaymentOperationalReview {
  readonly reviewId: string;
  readonly category: 'PAID_CANCELLATION';
  readonly status: 'OPEN' | 'RESOLVED';
  readonly openedAt: string;
  readonly openedReason: string;
}

export interface AdminPaymentBooking {
  readonly bookingCode: string;
  readonly status:
    'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestName: string;
  readonly finalAmountVnd: number;
  readonly currency: string;
}

export interface AdminPaymentDetail {
  readonly paymentId: string;
  readonly bookingCode: string;
  readonly provider: AdminPaymentProvider | null;
  readonly status: AdminPaymentStatus;
  readonly amountVnd: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly confirmedAt: string | null;
  readonly cancelledAt: string | null;
  readonly needsReview: boolean;
  readonly booking: AdminPaymentBooking;
  readonly attempts: readonly AdminPaymentAttempt[];
  readonly events: readonly AdminPaymentEvent[];
  readonly reconciliation: AdminPaymentReconciliation;
  readonly auditTrail: readonly AdminPaymentAuditEntry[];
  readonly operationalReview: AdminPaymentOperationalReview | null;
  readonly serverTime: string;
}

export interface AdminPaymentStatusQueryResult {
  readonly paymentId: string;
  readonly provider: AdminPaymentProvider | null;
  readonly status: AdminPaymentStatus;
  readonly previousStatus: AdminPaymentStatus;
  readonly authoritative: boolean;
  readonly providerReportedAt: string;
  readonly amountVnd: number;
  readonly currency: string;
  readonly message: string;
}

export interface AdminBookingDetail {
  readonly bookingCode: string;
  readonly status: BookingStatus;
  readonly property: { readonly code: string; readonly name: string; readonly timezone: string };
  readonly contact: AdminBookingContact;
  readonly occupancy: { readonly adults: number; readonly children: number };
  readonly roomType: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly maxOccupancy: number;
  };
  readonly room: { readonly id: string; readonly roomNumber: string } | null;
  readonly interval: { readonly checkIn: string; readonly checkOut: string };
  readonly pricing: AdminBookingPricing;
  readonly payment: AdminBookingPaymentSummary;
  readonly operationalReview: {
    readonly reviewId: string;
    readonly category: 'PAID_CANCELLATION';
    readonly status: 'OPEN' | 'RESOLVED';
    readonly openedAt: string;
    readonly openedReason: string;
    readonly resolvedAt: string | null;
    readonly resolvedNote: string | null;
  } | null;
  readonly timeline: readonly AdminBookingTimelineEntry[];
  readonly availableActions: readonly ('cancel' | 'check-in' | 'check-out' | 'no-show')[];
  readonly serverTime: string;
}

export interface AdminBookingAccessPassScanResult {
  readonly bookingCode: string;
  readonly status: BookingStatus;
  readonly action: 'check-in' | 'check-out';
}
