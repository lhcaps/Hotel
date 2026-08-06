export interface AdminBookingFilters {
  readonly bookingCode: string;
  readonly customerUserId: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly reviewPresence: string;
  readonly checkInFrom: string;
  readonly checkInTo: string;
}

export const emptyAdminBookingFilters: AdminBookingFilters = {
  bookingCode: '',
  customerUserId: '',
  status: '',
  paymentStatus: '',
  reviewPresence: '',
  checkInFrom: '',
  checkInTo: '',
};

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function readAdminBookingFilterState(input: URLSearchParams): {
  readonly page: number;
  readonly filters: AdminBookingFilters;
} {
  return {
    page: readPage(input.get('page')),
    filters: {
      bookingCode: input.get('q') ?? '',
      customerUserId: input.get('customerUserId') ?? '',
      status: input.get('status') ?? '',
      paymentStatus: input.get('paymentStatus') ?? '',
      reviewPresence: input.get('reviewPresence') ?? '',
      checkInFrom: input.get('checkInFrom') ?? '',
      checkInTo: input.get('checkInTo') ?? '',
    },
  };
}

export function toAdminBookingFilterQuery(page: number, filters: AdminBookingFilters): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(Math.floor(page)));
  if (filters.bookingCode !== '') params.set('q', filters.bookingCode);
  if (filters.customerUserId !== '') params.set('customerUserId', filters.customerUserId);
  if (filters.status !== '') params.set('status', filters.status);
  if (filters.paymentStatus !== '') params.set('paymentStatus', filters.paymentStatus);
  if (filters.reviewPresence !== '') params.set('reviewPresence', filters.reviewPresence);
  if (filters.checkInFrom !== '') params.set('checkInFrom', filters.checkInFrom);
  if (filters.checkInTo !== '') params.set('checkInTo', filters.checkInTo);
  return params.toString();
}

export function hasReversedAdminBookingDateRange(filters: AdminBookingFilters): boolean {
  return (
    filters.checkInFrom !== '' &&
    filters.checkInTo !== '' &&
    filters.checkInFrom > filters.checkInTo
  );
}
