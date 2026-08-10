import {
  adminCouponCreateSchema,
  couponListSchema,
  couponSchema,
  paginationQuerySchema,
  type AdminCouponCreate,
  type Coupon,
  type CouponList,
} from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';

import {
  CouponConflictError,
  CouponNotFoundError,
  CouponReferencedError,
} from './coupon.errors.js';

export interface CouponResult {
  readonly id: string;
  readonly propertyId: string;
  readonly code: string;
  readonly status: 'ACTIVE' | 'DISABLED';
  readonly lifecycle: 'AVAILABLE' | 'EXPIRED' | 'DISABLED';
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly fixedAmountVnd: bigint | null;
  readonly percentageBasisPoints: number | null;
  readonly maximumDiscountVnd: bigint | null;
  readonly minimumOrderAmountVnd: bigint;
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly appliesToAllRoomTypes: boolean;
  readonly roomTypeIds: readonly string[];
  readonly totalUsageLimit: number | null;
  readonly perCustomerLimit: number | null;
  readonly counts: {
    readonly activeReservations: number;
    readonly redeemed: number;
    readonly released: number;
  };
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly disabledAt: Date | null;
}

export interface DisableCouponResult {
  readonly coupon: CouponResult;
  readonly transitionedToDisabled: boolean;
}

export interface CouponRepositoryPort {
  getCurrentProperty(actor: ActorContext): Promise<{ readonly id: string } | undefined>;
  createCoupon(
    transaction: unknown,
    propertyId: string,
    command: AdminCouponCreate,
  ): Promise<CouponResult>;
  listCoupons(propertyId: string, page: number, pageSize: number): Promise<readonly CouponResult[]>;
  findCoupon(
    transaction: unknown,
    propertyId: string,
    couponId: string,
  ): Promise<CouponResult | undefined>;
  disableCoupon(
    transaction: unknown,
    propertyId: string,
    couponId: string,
  ): Promise<DisableCouponResult | undefined>;
  verifyRoomTypesExist(propertyId: string, roomTypeIds: readonly string[]): Promise<void>;
}

export interface AuditRepositoryPort {
  write(
    transaction: unknown,
    event: {
      readonly propertyId: string;
      readonly aggregateType: string;
      readonly aggregateId: string;
      readonly eventType: string;
      readonly actorId: string;
      readonly payload: Record<string, string | number>;
    },
  ): Promise<void>;
}

export interface TransactionManager {
  transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
}

function hasPostgresCode(error: unknown, code: string, depth = 0): boolean {
  if (depth > 3 || typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === code) return true;
  return 'cause' in error && hasPostgresCode(error.cause, code, depth + 1);
}

function toCoupon(record: CouponResult): Coupon {
  return couponSchema.parse({
    id: record.id,
    propertyId: record.propertyId,
    code: record.code,
    status: record.status,
    lifecycle: record.lifecycle,
    discountType: record.discountType,
    fixedAmountVnd: record.fixedAmountVnd === null ? null : Number(record.fixedAmountVnd),
    percentageBasisPoints: record.percentageBasisPoints,
    maximumDiscountVnd:
      record.maximumDiscountVnd === null ? null : Number(record.maximumDiscountVnd),
    minimumOrderAmountVnd: Number(record.minimumOrderAmountVnd),
    validFrom: record.validFrom.toISOString(),
    validUntil: record.validUntil.toISOString(),
    appliesToAllRoomTypes: record.appliesToAllRoomTypes,
    roomTypeIds: record.roomTypeIds,
    totalUsageLimit: record.totalUsageLimit,
    perCustomerLimit: record.perCustomerLimit,
    counts: record.counts,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    disabledAt: record.disabledAt?.toISOString() ?? null,
  });
}

export class CouponService {
  public constructor(
    private readonly database: TransactionManager,
    private readonly repository: CouponRepositoryPort,
    private readonly audit: AuditRepositoryPort,
  ) {}

  public async createCoupon(actor: ActorContext, input: unknown): Promise<Coupon> {
    const command = adminCouponCreateSchema.parse(input);
    try {
      return await this.database.transaction(async (transaction) => {
        const property = await this.repository.getCurrentProperty(actor);
        if (property === undefined) throw new CouponNotFoundError();
        const selection = command.roomTypes;
        if ('roomTypeIds' in selection) {
          await this.repository.verifyRoomTypesExist(property.id, selection.roomTypeIds);
        }
        const coupon = await this.repository.createCoupon(transaction, property.id, command);
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'COUPON',
          aggregateId: coupon.id,
          eventType: 'COUPON_CREATED',
          actorId: actor.userId,
          payload: {
            code: coupon.code,
            discountType: coupon.discountType,
            fixedAmountVnd: coupon.fixedAmountVnd === null ? 0 : Number(coupon.fixedAmountVnd),
            percentageBasisPoints: coupon.percentageBasisPoints ?? 0,
            maximumDiscountVnd:
              coupon.maximumDiscountVnd === null ? 0 : Number(coupon.maximumDiscountVnd),
            minimumOrderAmountVnd: Number(coupon.minimumOrderAmountVnd),
            totalUsageLimit: coupon.totalUsageLimit ?? 0,
            perCustomerLimit: coupon.perCustomerLimit ?? 0,
          },
        });
        return toCoupon(coupon);
      });
    } catch (error) {
      if (hasPostgresCode(error, '23505')) throw new CouponConflictError();
      if (hasPostgresCode(error, 'P0001')) {
        const message = (error as { message?: string }).message ?? '';
        if (message.includes('referenced')) throw new CouponReferencedError();
      }
      throw error;
    }
  }

  public async listCoupons(actor: ActorContext, input: unknown): Promise<CouponList> {
    const page = paginationQuerySchema.parse(input);
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CouponNotFoundError();
    const items = await this.repository.listCoupons(property.id, page.page, page.pageSize);
    return couponListSchema.parse({
      page: page.page,
      pageSize: page.pageSize,
      items: items.map(toCoupon),
    });
  }

  public async getCoupon(actor: ActorContext, couponId: string): Promise<Coupon> {
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CouponNotFoundError();
    const coupon = await this.repository.findCoupon(undefined, property.id, couponId);
    if (coupon === undefined) throw new CouponNotFoundError();
    return toCoupon(coupon);
  }

  public async disableCoupon(actor: ActorContext, couponId: string): Promise<Coupon> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor);
      if (property === undefined) throw new CouponNotFoundError();
      const result = await this.repository.disableCoupon(transaction, property.id, couponId);
      if (result === undefined) throw new CouponNotFoundError();
      if (result.transitionedToDisabled) {
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'COUPON',
          aggregateId: result.coupon.id,
          eventType: 'COUPON_DISABLED',
          actorId: actor.userId,
          payload: { code: result.coupon.code },
        });
      }
      return toCoupon(result.coupon);
    });
  }
}
