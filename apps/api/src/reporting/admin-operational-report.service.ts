import {
  adminOperationalReportSchema,
  adminOperationalReportQuerySchema,
  type AdminOperationalReport,
} from '@room/contracts';

export interface AdminOperationalReportRepositoryQuery {
  from: string;
  to: string;
  bookingStatuses?: readonly string[] | undefined;
  paymentStatuses?: readonly string[] | undefined;
  ratePlanCodes?: readonly string[] | undefined;
  roomTierCodes?: readonly string[] | undefined;
}

export interface OperationalReportSeriesPoint {
  date: string;
  revenueVnd: bigint;
  bookingCount: number;
}

export interface OperationalReportBreakdownPoint {
  label: string;
  revenueVnd: bigint;
  bookingCount: number;
}

export interface AdminOperationalReportAggregate {
  grossRevenueVnd: bigint;
  settledRevenueVnd: bigint;
  bookingCount: number;
  confirmedCount: number;
  cancellationCount: number;
  paymentReviewCount: number;
  customerCount: number;
  returningCustomerCount: number;
  daily: readonly OperationalReportSeriesPoint[];
  ratePlans: readonly OperationalReportBreakdownPoint[];
  roomTypes: readonly OperationalReportBreakdownPoint[];
}

export interface AdminOperationalReportRepositoryPort {
  getReport(
    propertyId: string,
    query: AdminOperationalReportRepositoryQuery,
  ): Promise<AdminOperationalReportAggregate>;
}

const toSafeNumber = (value: bigint, field: string): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${field} exceeds the safe integer range`);
  }

  return Number(value);
};

/**
 * Shapes authoritative reporting aggregates for the administrative API.
 * Outstanding revenue intentionally remains unavailable until a partial-payment
 * ledger exists; it must never be inferred by subtracting unrelated totals.
 */
export class AdminOperationalReportService {
  constructor(private readonly repository: AdminOperationalReportRepositoryPort) {}

  async getReport(
    propertyId: string,
    query: unknown,
    now = new Date(),
  ): Promise<AdminOperationalReport> {
    const parsed = adminOperationalReportQuerySchema.parse(query);
    const report = await this.repository.getReport(propertyId, parsed);

    return adminOperationalReportSchema.parse({
      grossRevenueVnd: toSafeNumber(report.grossRevenueVnd, 'grossRevenueVnd'),
      settledRevenueVnd: toSafeNumber(report.settledRevenueVnd, 'settledRevenueVnd'),
      outstandingRevenueVnd: null,
      bookingCount: report.bookingCount,
      confirmedCount: report.confirmedCount,
      cancellationCount: report.cancellationCount,
      paymentReviewCount: report.paymentReviewCount,
      customerCount: report.customerCount,
      returningCustomerCount: report.returningCustomerCount,
      daily: report.daily.map((point) => ({
        date: point.date,
        revenueVnd: toSafeNumber(point.revenueVnd, 'daily.revenueVnd'),
        bookingCount: point.bookingCount,
      })),
      ratePlans: report.ratePlans.map((point) => ({
        label: point.label,
        revenueVnd: toSafeNumber(point.revenueVnd, 'ratePlans.revenueVnd'),
        bookingCount: point.bookingCount,
      })),
      roomTypes: report.roomTypes.map((point) => ({
        label: point.label,
        revenueVnd: toSafeNumber(point.revenueVnd, 'roomTypes.revenueVnd'),
        bookingCount: point.bookingCount,
      })),
      generatedAt: now.toISOString(),
    });
  }
}
