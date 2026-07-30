import {
  and,
  asc,
  bookingCouponApplications,
  coupons,
  couponRoomTypes,
  eq,
  ne,
  type DatabaseClient,
} from '@room/database';
import { normalizeCouponCode } from '@room/booking/coupon';

import type { AdminCouponCreate, CouponLifecycle } from '@room/contracts';

import type { CouponRepositoryPort, CouponResult, DisableCouponResult } from './coupon.service.js';

type CouponDatabase = Pick<DatabaseClient, 'insert' | 'query' | 'update' | 'select'>;

function asCouponDatabase(transaction: unknown, fallback: CouponDatabase): CouponDatabase {
  return transaction === undefined ? fallback : (transaction as CouponDatabase);
}

export interface CouponRepositoryOptions {
  readonly database: CouponDatabase;
}

export class CouponRepository implements CouponRepositoryPort {
  public constructor(private readonly database: CouponDatabase) {}

  public async getCurrentProperty(): Promise<{ readonly id: string } | undefined> {
    const row = await this.database.query.properties.findFirst({
      where: (property, operators) => operators.eq(property.status, 'ACTIVE'),
      orderBy: (property, operators) => [
        operators.asc(property.createdAt),
        operators.asc(property.id),
      ],
    });
    if (row === undefined) return undefined;
    return { id: row.id };
  }

  public async verifyRoomTypesExist(
    propertyId: string,
    roomTypeIds: readonly string[],
  ): Promise<void> {
    const rows = await this.database.query.roomTypes.findMany({
      where: (row, op) =>
        op.and(op.eq(row.propertyId, propertyId), op.inArray(row.id, [...roomTypeIds])),
    });
    if (rows.length !== roomTypeIds.length) {
      throw new Error('Coupon references a room type that does not exist for this property.');
    }
  }

  public async createCoupon(
    transaction: unknown,
    propertyId: string,
    command: AdminCouponCreate,
  ): Promise<CouponResult> {
    const database = asCouponDatabase(transaction, this.database);
    const normalizedCode = normalizeCouponCode(command.code);
    const fixedAmountVnd =
      command.discountType === 'FIXED' ? BigInt(command.fixedAmountVnd ?? 0) : null;
    const percentageBasisPoints =
      command.discountType === 'PERCENTAGE' ? Math.trunc(command.percentageBasisPoints ?? 0) : null;
    const maximumDiscountVnd =
      command.discountType === 'PERCENTAGE' && command.maximumDiscountVnd != null
        ? BigInt(command.maximumDiscountVnd)
        : null;
    const appliesToAllRoomTypes = 'all' in command.roomTypes && command.roomTypes.all === true;

    const [created] = await database
      .insert(coupons)
      .values({
        propertyId,
        normalizedCode,
        status: 'ACTIVE',
        discountType: command.discountType,
        fixedAmountVnd,
        percentageBasisPoints,
        maximumDiscountVnd,
        minimumOrderAmountVnd: BigInt(command.minimumOrderAmountVnd),
        validFrom: new Date(command.validFrom),
        validUntil: new Date(command.validUntil),
        appliesToAllRoomTypes,
        totalUsageLimit: command.totalUsageLimit ?? null,
        perCustomerLimit: command.perCustomerLimit ?? null,
      })
      .returning();
    if (created === undefined) throw new Error('Coupon creation did not return a row.');

    if (!appliesToAllRoomTypes && 'roomTypeIds' in command.roomTypes) {
      const ids = command.roomTypes.roomTypeIds;
      await database.insert(couponRoomTypes).values(
        ids.map((roomTypeId: string) => ({
          propertyId,
          couponId: created.id,
          roomTypeId,
        })),
      );
    }

    return this.toCouponResult(database, created);
  }

  public async listCoupons(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CouponResult[]> {
    const rows = await this.database.query.coupons.findMany({
      where: (row, op) => op.eq(row.propertyId, propertyId),
      orderBy: [asc(coupons.createdAt), asc(coupons.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return Promise.all(rows.map((row) => this.toCouponResult(this.database, row)));
  }

  public async findCoupon(
    transaction: unknown,
    propertyId: string,
    couponId: string,
  ): Promise<CouponResult | undefined> {
    const database = asCouponDatabase(transaction, this.database);
    const row = await database.query.coupons.findFirst({
      where: (c, op) => op.and(op.eq(c.propertyId, propertyId), op.eq(c.id, couponId)),
    });
    if (row === undefined) return undefined;
    return this.toCouponResult(database, row);
  }

  public async disableCoupon(
    transaction: unknown,
    propertyId: string,
    couponId: string,
  ): Promise<DisableCouponResult | undefined> {
    const database = asCouponDatabase(transaction, this.database);
    const now = new Date();
    const [updated] = await database
      .update(coupons)
      .set({ status: 'DISABLED', disabledAt: now, updatedAt: now })
      .where(
        and(
          eq(coupons.id, couponId),
          eq(coupons.propertyId, propertyId),
          ne(coupons.status, 'DISABLED'),
        ),
      )
      .returning();
    if (updated !== undefined) {
      const coupon = await this.toCouponResult(database, updated);
      return { coupon, transitionedToDisabled: true };
    }
    const existing = await database.query.coupons.findFirst({
      where: (c, op) => op.and(op.eq(c.propertyId, propertyId), op.eq(c.id, couponId)),
    });
    if (existing === undefined) return undefined;
    const coupon = await this.toCouponResult(database, existing);
    return { coupon, transitionedToDisabled: false };
  }

  private async toCouponResult(database: CouponDatabase, row: CouponRow): Promise<CouponResult> {
    const [counts, scopedRoomTypes] = await Promise.all([
      this.aggregateCounts(database, row.id),
      this.listRoomTypeIds(database, row.id, row.appliesToAllRoomTypes),
    ]);
    const lifecycle = this.computeLifecycle(row);
    return {
      id: row.id,
      propertyId: row.propertyId,
      code: row.normalizedCode,
      status: row.status,
      lifecycle,
      discountType: row.discountType,
      fixedAmountVnd: row.fixedAmountVnd,
      percentageBasisPoints: row.percentageBasisPoints,
      maximumDiscountVnd: row.maximumDiscountVnd,
      minimumOrderAmountVnd: row.minimumOrderAmountVnd,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      appliesToAllRoomTypes: row.appliesToAllRoomTypes,
      roomTypeIds: scopedRoomTypes,
      totalUsageLimit: row.totalUsageLimit,
      perCustomerLimit: row.perCustomerLimit,
      counts,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      disabledAt: row.disabledAt,
    };
  }

  private async listRoomTypeIds(
    database: CouponDatabase,
    couponId: string,
    appliesToAllRoomTypes: boolean,
  ): Promise<readonly string[]> {
    if (appliesToAllRoomTypes) return [];
    const rows = await database.query.couponRoomTypes.findMany({
      where: (row, op) => op.eq(row.couponId, couponId),
      orderBy: [asc(couponRoomTypes.roomTypeId)],
    });
    return rows.map((row) => row.roomTypeId);
  }

  private async aggregateCounts(
    database: CouponDatabase,
    couponId: string,
  ): Promise<CouponResult['counts']> {
    const rows = await database
      .select({
        applicationStatus: bookingCouponApplications.applicationStatus,
      })
      .from(bookingCouponApplications)
      .where(eq(bookingCouponApplications.couponId, couponId));
    let activeReservations = 0;
    let redeemed = 0;
    let released = 0;
    for (const row of rows) {
      if (row.applicationStatus === 'RESERVED') activeReservations += 1;
      else if (row.applicationStatus === 'REDEEMED') redeemed += 1;
      else if (row.applicationStatus === 'RELEASED') released += 1;
    }
    return { activeReservations, redeemed, released };
  }

  private computeLifecycle(row: CouponRow): CouponLifecycle {
    if (row.status === 'DISABLED') return 'DISABLED';
    const now = new Date();
    if (row.validUntil.getTime() <= now.getTime()) return 'EXPIRED';
    return 'AVAILABLE';
  }
}

type CouponRow = {
  id: string;
  propertyId: string;
  normalizedCode: string;
  status: 'ACTIVE' | 'DISABLED';
  discountType: 'FIXED' | 'PERCENTAGE';
  fixedAmountVnd: bigint | null;
  percentageBasisPoints: number | null;
  maximumDiscountVnd: bigint | null;
  minimumOrderAmountVnd: bigint;
  validFrom: Date;
  validUntil: Date;
  appliesToAllRoomTypes: boolean;
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
