import type { DatabasePool } from '@room/database';

import type {
  AdminOperationalReportAggregate,
  AdminOperationalReportRepositoryPort,
  AdminOperationalReportRepositoryQuery,
  OperationalReportBreakdownPoint,
  OperationalReportSeriesPoint,
} from './admin-operational-report.service.js';

interface MetricRow {
  gross_revenue_vnd: string | number | bigint;
  settled_revenue_vnd: string | number | bigint;
  booking_count: string | number | bigint;
  confirmed_count: string | number | bigint;
  cancellation_count: string | number | bigint;
  customer_count: string | number | bigint;
  returning_customer_count: string | number | bigint;
}

interface DailyRow {
  date: string;
  revenue_vnd: string | number | bigint;
  booking_count: string | number | bigint;
}

interface BreakdownRow {
  label: string;
  revenue_vnd: string | number | bigint;
  booking_count: string | number | bigint;
}

interface ReportFilters {
  readonly whereSql: string;
  readonly params: unknown[];
}

function asBigInt(value: string | number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function asCount(value: string | number | bigint): number {
  const parsed = asBigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER) || parsed < 0n) {
    throw new RangeError('report count exceeds the safe integer range');
  }
  return Number(parsed);
}

function buildFilters(
  propertyId: string,
  query: AdminOperationalReportRepositoryQuery,
): ReportFilters {
  const conditions = ['b.property_id = $1', 'b.check_in >= $2', 'b.check_in <= $3'];
  const params: unknown[] = [propertyId, new Date(query.from), new Date(query.to)];
  let index = 4;

  if (query.bookingStatuses !== undefined && query.bookingStatuses.length > 0) {
    conditions.push(`b.status = ANY($${index}::booking_status[])`);
    params.push(query.bookingStatuses);
    index += 1;
  }

  if (query.paymentStatuses !== undefined && query.paymentStatuses.length > 0) {
    const includesNone = query.paymentStatuses.includes('NONE');
    const concreteStatuses = query.paymentStatuses.filter((status) => status !== 'NONE');
    if (includesNone && concreteStatuses.length > 0) {
      conditions.push(`(pay.status = ANY($${index}::payment_status[]) OR pay.status IS NULL)`);
      params.push(concreteStatuses);
      index += 1;
    } else if (includesNone) {
      conditions.push('pay.status IS NULL');
    } else {
      conditions.push(`pay.status = ANY($${index}::payment_status[])`);
      params.push(concreteStatuses);
      index += 1;
    }
  }

  if (query.ratePlanCodes !== undefined && query.ratePlanCodes.length > 0) {
    conditions.push(
      `COALESCE(b.price_snapshot ->> 'ratePlanCode', b.price_snapshot #>> '{pricing,selectedPlanCode}', 'UNSPECIFIED') = ANY($${index}::text[])`,
    );
    params.push(query.ratePlanCodes);
    index += 1;
  }

  if (query.roomTierCodes !== undefined && query.roomTierCodes.length > 0) {
    conditions.push(`pt.code = ANY($${index}::text[])`);
    params.push(query.roomTierCodes);
  }

  return { whereSql: conditions.join(' AND '), params };
}

function baseCte(filters: ReportFilters): string {
  return `
    WITH base AS (
      SELECT b.status,
             b.final_amount_vnd,
             b.customer_user_id,
             pay.status AS payment_status,
             rt.name AS room_type_name,
             COALESCE(
               b.price_snapshot ->> 'ratePlanCode',
               b.price_snapshot #>> '{pricing,selectedPlanCode}',
               'UNSPECIFIED'
             ) AS rate_plan_code,
             (b.check_in AT TIME ZONE p.timezone)::date::text AS local_date
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        JOIN price_tiers pt ON pt.property_id = rt.property_id AND pt.id = rt.price_tier_id
        LEFT JOIN payments pay ON pay.booking_id = b.id
       WHERE ${filters.whereSql}
    )`;
}

function toSeriesPoint(row: DailyRow): OperationalReportSeriesPoint {
  return {
    date: row.date,
    revenueVnd: asBigInt(row.revenue_vnd),
    bookingCount: asCount(row.booking_count),
  };
}

function toBreakdownPoint(row: BreakdownRow): OperationalReportBreakdownPoint {
  return {
    label: row.label,
    revenueVnd: asBigInt(row.revenue_vnd),
    bookingCount: asCount(row.booking_count),
  };
}

/** SQL aggregation boundary for the administrative operational report. */
export class AdminOperationalReportRepository implements AdminOperationalReportRepositoryPort {
  public constructor(private readonly pool: Pick<DatabasePool, 'query'>) {}

  public async getReport(
    propertyId: string,
    query: AdminOperationalReportRepositoryQuery,
  ): Promise<AdminOperationalReportAggregate> {
    const filters = buildFilters(propertyId, query);
    const cte = baseCte(filters);

    const metricsSql = `${cte},
      returning_customers AS (
        SELECT customer_user_id
          FROM base
         WHERE customer_user_id IS NOT NULL
         GROUP BY customer_user_id
        HAVING COUNT(*) > 1
      )
      SELECT COALESCE(SUM(final_amount_vnd) FILTER (
               WHERE status NOT IN ('CANCELLED', 'EXPIRED')
             ), 0)::text AS gross_revenue_vnd,
             COALESCE(SUM(final_amount_vnd) FILTER (
               WHERE status NOT IN ('CANCELLED', 'EXPIRED')
                 AND payment_status = 'SUCCEEDED'
             ), 0)::text AS settled_revenue_vnd,
             COUNT(*)::text AS booking_count,
             COUNT(*) FILTER (WHERE status = 'CONFIRMED')::text AS confirmed_count,
             COUNT(*) FILTER (WHERE status = 'CANCELLED')::text AS cancellation_count,
             COUNT(DISTINCT customer_user_id)::text AS customer_count,
             (SELECT COUNT(*)::text FROM returning_customers) AS returning_customer_count
        FROM base`;

    const dailySql = `${cte}
      SELECT local_date AS date,
             COALESCE(SUM(final_amount_vnd) FILTER (
               WHERE status NOT IN ('CANCELLED', 'EXPIRED')
             ), 0)::text AS revenue_vnd,
             COUNT(*)::text AS booking_count
        FROM base
       GROUP BY local_date
       ORDER BY local_date ASC`;

    const ratePlansSql = `${cte}
      SELECT rate_plan_code AS label,
             COALESCE(SUM(final_amount_vnd) FILTER (
               WHERE status NOT IN ('CANCELLED', 'EXPIRED')
             ), 0)::text AS revenue_vnd,
             COUNT(*)::text AS booking_count
        FROM base
       GROUP BY rate_plan_code
       ORDER BY revenue_vnd DESC, label ASC`;

    const roomTypesSql = `${cte}
      SELECT room_type_name AS label,
             COALESCE(SUM(final_amount_vnd) FILTER (
               WHERE status NOT IN ('CANCELLED', 'EXPIRED')
             ), 0)::text AS revenue_vnd,
             COUNT(*)::text AS booking_count
        FROM base
       GROUP BY room_type_name
       ORDER BY revenue_vnd DESC, label ASC`;

    const [metricsResult, dailyResult, ratePlansResult, roomTypesResult] = await Promise.all([
      this.pool.query<MetricRow>(metricsSql, filters.params),
      this.pool.query<DailyRow>(dailySql, filters.params),
      this.pool.query<BreakdownRow>(ratePlansSql, filters.params),
      this.pool.query<BreakdownRow>(roomTypesSql, filters.params),
    ]);
    const metrics = metricsResult.rows[0];
    if (metrics === undefined) {
      throw new Error('Operational report metrics query returned no row');
    }

    return {
      grossRevenueVnd: asBigInt(metrics.gross_revenue_vnd),
      settledRevenueVnd: asBigInt(metrics.settled_revenue_vnd),
      bookingCount: asCount(metrics.booking_count),
      confirmedCount: asCount(metrics.confirmed_count),
      cancellationCount: asCount(metrics.cancellation_count),
      customerCount: asCount(metrics.customer_count),
      returningCustomerCount: asCount(metrics.returning_customer_count),
      daily: dailyResult.rows.map(toSeriesPoint),
      ratePlans: ratePlansResult.rows.map(toBreakdownPoint),
      roomTypes: roomTypesResult.rows.map(toBreakdownPoint),
    };
  }
}
