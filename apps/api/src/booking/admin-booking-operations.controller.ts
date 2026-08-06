import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import type {
  AdminBookingDetail,
  AdminBookingAccessPassScanResponse,
  AdminBookingListResponse,
  AdminOperationalReviewDetail,
  AdminOperationalReviewListResponse,
} from '@room/contracts';
import { adminBookingAccessPassScanRequestSchema } from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';
import { AdminBookingAccessPassService } from './services/admin-booking-access-pass.service.js';
import { CouponDeliveryService } from './services/coupon-delivery.service.js';

type AdminRequest = {
  readonly actor: ActorContext;
  readonly id: string;
};

@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class AdminBookingOperationsController {
  public constructor(
    @Inject(AdminBookingLifecycleService)
    private readonly lifecycle: AdminBookingLifecycleService,
    @Inject(PropertyContextService)
    private readonly propertyContext: PropertyContextService,
    @Inject(CouponDeliveryService)
    private readonly couponDelivery: CouponDeliveryService,
    @Inject(AdminBookingAccessPassService)
    private readonly accessPasses: AdminBookingAccessPassService,
  ) {}

  @Get('bookings')
  @Version('1')
  @RequirePermissions('booking.lifecycle.read')
  public async listBookings(
    @Query() query: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingListResponse> {
    const property = await this.propertyContext.getCurrent();
    void request;
    return this.lifecycle.listBookings(property.id, query, property.timezone);
  }

  @Get('bookings/:bookingCode')
  @Version('1')
  @RequirePermissions('booking.lifecycle.read')
  public async getBookingDetail(
    @Param('bookingCode') bookingCode: string,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    void request;
    return this.lifecycle.getDetail(bookingCode, new Date());
  }

  @Post('booking-access-passes/scan')
  @Version('1')
  @RequirePermissions('booking.lifecycle.read')
  public async scanAccessPass(
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingAccessPassScanResponse> {
    void request;
    const command = adminBookingAccessPassScanRequestSchema.parse(body);
    return this.accessPasses.scan(command.value, new Date());
  }

  @Post('bookings/:bookingCode/send-coupons')
  @Version('1')
  @RequirePermissions('booking.lifecycle.manage', 'coupon.manage')
  public sendCoupons(
    @Param('bookingCode') bookingCode: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AdminRequest,
  ) {
    return this.couponDelivery.request(request.actor, bookingCode, body, idempotencyKey ?? '');
  }

  @Post('bookings/:bookingCode/cancel')
  @Version('1')
  @RequirePermissions('booking.lifecycle.manage')
  public async cancelBooking(
    @Param('bookingCode') bookingCode: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    if (idempotencyKey === undefined || idempotencyKey.trim() === '') {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return this.lifecycle.cancel(request.actor, bookingCode, body, new Date(), idempotencyKey);
  }

  @Post('bookings/:bookingCode/cancellation-preview')
  @Version('1')
  @RequirePermissions('booking.lifecycle.read')
  public async cancellationPreview(
    @Param('bookingCode') bookingCode: string,
    @Req() request: AdminRequest,
  ) {
    void request;
    return this.lifecycle.cancellationPreview(bookingCode, new Date());
  }

  @Post('bookings/:bookingCode/check-in')
  @Version('1')
  @RequirePermissions('booking.lifecycle.manage')
  public async checkInBooking(
    @Param('bookingCode') bookingCode: string,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    return this.lifecycle.checkIn(request.actor, bookingCode, new Date());
  }

  @Post('bookings/:bookingCode/check-out')
  @Version('1')
  @RequirePermissions('booking.lifecycle.manage')
  public async checkOutBooking(
    @Param('bookingCode') bookingCode: string,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    return this.lifecycle.checkOut(request.actor, bookingCode, new Date());
  }

  @Post('bookings/:bookingCode/no-show')
  @Version('1')
  @RequirePermissions('booking.lifecycle.manage')
  public async markBookingNoShow(
    @Param('bookingCode') bookingCode: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    return this.lifecycle.markNoShow(request.actor, bookingCode, body, new Date());
  }

  @Get('operational-reviews')
  @Version('1')
  @RequirePermissions('booking.review.read')
  public async listOperationalReviews(
    @Query() query: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminOperationalReviewListResponse> {
    const property = await this.propertyContext.getCurrent();
    void request;
    return this.lifecycle.listOperationalReviews(property.id, query);
  }

  @Get('operational-reviews/:reviewId')
  @Version('1')
  @RequirePermissions('booking.review.read')
  public async getOperationalReview(
    @Param('reviewId') reviewId: string,
  ): Promise<AdminOperationalReviewDetail> {
    return this.lifecycle.getOperationalReviewDetail(reviewId, new Date());
  }

  @Post('operational-reviews/:reviewId/resolve')
  @Version('1')
  @RequirePermissions('booking.review.manage')
  public async resolveOperationalReview(
    @Param('reviewId') reviewId: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminOperationalReviewDetail> {
    return this.lifecycle.resolveOperationalReview(request.actor, reviewId, body, new Date());
  }
}
