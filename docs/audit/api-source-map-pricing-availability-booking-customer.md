# API Source Audit Map

> Generated from every TypeScript source file under `apps/api/src/pricing/**`, `availability/**`, `booking/**`, and `customer/**`. Static extraction preserves exact paths and declaration text where matched; inspect the linked source for complete bodies.

## Scope

- Source files scanned: **44**
- Test files scanned: pricing, availability, booking, customer-related API tests.

## `apps/api/src/booking/admin-booking-operations.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\admin-booking-operations.controller.ts`
- Lines: 142

### Top-level declarations / exports

- `export class AdminBookingOperationsController`
- `type AdminRequest`

### Function / method signatures

- None detected by static scan.

### Database tables / schema references

- `@Get('bookings')`
- `@Get('bookings/:bookingCode')`
- `@Post('bookings/:bookingCode/cancel')`
- `@Post('bookings/:bookingCode/check-in')`
- `@Post('bookings/:bookingCode/check-out')`
- `@Post('bookings/:bookingCode/no-show')`
- `import type { ActorContext } from '../auth/actor-context.js';`
- `import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';`
- `import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';`
- `import { PropertyContextService } from '../catalog/property-context.service.js';`
- `import { RequirePermissions } from '../auth/permissions.decorator.js';`
- `} from '@nestjs/common';`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `new Date(),`
- `return this.lifecycle.cancel(request.actor, bookingCode, body, new Date());`
- `return this.lifecycle.checkIn(request.actor, bookingCode, new Date());`
- `return this.lifecycle.checkOut(request.actor, bookingCode, new Date());`
- `return this.lifecycle.getDetail(bookingCode, new Date());`
- `return this.lifecycle.getOperationalReviewDetail(reviewId, new Date());`
- `return this.lifecycle.markNoShow(request.actor, bookingCode, body, new Date());`

### Money / arithmetic operations

- `@Get('bookings/:bookingCode')`
- `@Get('operational-reviews/:reviewId')`
- `@Post('bookings/:bookingCode/cancel')`
- `@Post('bookings/:bookingCode/check-in')`
- `@Post('bookings/:bookingCode/check-out')`
- `@Post('bookings/:bookingCode/no-show')`
- `@Post('operational-reviews/:reviewId/resolve')`
- `import type { ActorContext } from '../auth/actor-context.js';`
- `import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';`
- `import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';`
- `import { PropertyContextService } from '../catalog/property-context.service.js';`
- `import { RequirePermissions } from '../auth/permissions.decorator.js';`
- `} from '@nestjs/common';`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- `@Body() body: unknown,`
- `@Controller('admin')`
- `@Get('bookings')`
- `@Get('bookings/:bookingCode')`
- `@Get('operational-reviews')`
- `@Get('operational-reviews/:reviewId')`
- `@Param('bookingCode') bookingCode: string,`
- `@Param('reviewId') reviewId: string,`
- `@Post('bookings/:bookingCode/cancel')`
- `@Post('bookings/:bookingCode/check-in')`
- `@Post('bookings/:bookingCode/check-out')`
- `@Post('bookings/:bookingCode/no-show')`
- `@Post('operational-reviews/:reviewId/resolve')`
- `@Query() query: unknown,`
- `@Req() request: AdminRequest,`
- `@RequirePermissions('booking.lifecycle.manage')`
- `@RequirePermissions('booking.lifecycle.read')`
- `@RequirePermissions('booking.review.manage')`
- `@RequirePermissions('booking.review.read')`
- `@Version('1')`

### Verbatim source

```typescript
import {
  Body,
  Controller,
  Get,
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
  AdminBookingListResponse,
  AdminOperationalReviewDetail,
  AdminOperationalReviewListResponse,
} from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';

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
    return this.lifecycle.listBookings(property.id, query);
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

  @Post('bookings/:bookingCode/cancel')
  @Version('1')
  @RequirePermissions('booking.lifecycle.manage')
  public async cancelBooking(
    @Param('bookingCode') bookingCode: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    return this.lifecycle.cancel(request.actor, bookingCode, body, new Date());
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
```

## `apps/api/src/booking/admin-booking.errors.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\admin-booking.errors.ts`
- Lines: 36

### Top-level declarations / exports

- `export class BookingTransitionError extends Error`
- `export class NoShowBeforeCheckInError extends Error`
- `export class OperationalReviewAlreadyResolvedError extends Error`
- `export class OperationalReviewNotFoundError extends Error`

### Function / method signatures

- `public constructor()`
- `public constructor(message?: string)`
- `super('No-show can only be marked at or after the expected check-in time.')`
- `super('The requested operational review is already resolved.')`
- `super('The requested operational review was not found.')`
- `super(message ?? 'Booking transition is not allowed for the current state.')`

### Database tables / schema references

- None detected by static scan.

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- None detected by static scan.

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
export class BookingTransitionError extends Error {
  public readonly code: 'BOOKING_TRANSITION_NOT_ALLOWED';

  public constructor(message?: string) {
    super(message ?? 'Booking transition is not allowed for the current state.');
    this.name = 'BookingTransitionError';
    this.code = 'BOOKING_TRANSITION_NOT_ALLOWED';
  }
}

export class NoShowBeforeCheckInError extends Error {
  public readonly code = 'NO_SHOW_BEFORE_CHECK_IN';

  public constructor() {
    super('No-show can only be marked at or after the expected check-in time.');
    this.name = 'NoShowBeforeCheckInError';
  }
}

export class OperationalReviewNotFoundError extends Error {
  public readonly code = 'OPERATIONAL_REVIEW_NOT_FOUND';

  public constructor() {
    super('The requested operational review was not found.');
    this.name = 'OperationalReviewNotFoundError';
  }
}

export class OperationalReviewAlreadyResolvedError extends Error {
  public readonly code = 'OPERATIONAL_REVIEW_ALREADY_RESOLVED';

  public constructor() {
    super('The requested operational review is already resolved.');
    this.name = 'OperationalReviewAlreadyResolvedError';
  }
}
```

## `apps/api/src/booking/booking-detail.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\booking-detail.controller.ts`
- Lines: 28

### Top-level declarations / exports

- `export class BookingDetailController`
- `interface RequestLike`

### Function / method signatures

- `if (token === null)`
- `public async get(@Param('bookingCode') bookingCode: string, @Req() request: RequestLike)`

### Database tables / schema references

- `@Controller('public/bookings')`
- `import { BookingDetailService } from './services/booking-detail.service.js';`
- `import { Controller, Get, Inject, Param, Req, Version } from '@nestjs/common';`
- `import { GuestSessionRequiredError, GuestSessionService } from './services/guest-session.service.js';`
- `import { parseGuestSessionCookie } from './cookie.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `return this.details.getByBookingCode(bookingCode, token, new Date());`

### Money / arithmetic operations

- `@Controller('public/bookings')`
- `import { BookingDetailService } from './services/booking-detail.service.js';`
- `import { Controller, Get, Inject, Param, Req, Version } from '@nestjs/common';`
- `import { GuestSessionRequiredError, GuestSessionService } from './services/guest-session.service.js';`
- `import { parseGuestSessionCookie } from './cookie.js';`

### Routing decorators / endpoint declarations

- `@Controller('public/bookings')`
- `@Get(':bookingCode')`
- `@Version('1')`

### Verbatim source

```typescript
import { Controller, Get, Inject, Param, Req, Version } from '@nestjs/common';

import { BookingDetailService } from './services/booking-detail.service.js';
import {
  GuestSessionRequiredError,
  GuestSessionService,
} from './services/guest-session.service.js';
import { parseGuestSessionCookie } from './cookie.js';

interface RequestLike {
  readonly cookies?: Record<string, string | undefined>;
}

@Controller('public/bookings')
export class BookingDetailController {
  public constructor(
    @Inject(BookingDetailService) private readonly details: BookingDetailService,
    @Inject(GuestSessionService) private readonly sessions: GuestSessionService,
  ) {}

  @Get(':bookingCode')
  @Version('1')
  public async get(@Param('bookingCode') bookingCode: string, @Req() request: RequestLike) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    const token = raw === undefined || raw === '' ? null : parseGuestSessionCookie(raw);
    if (token === null) {
      throw new GuestSessionRequiredError();
    }
    return this.details.getByBookingCode(bookingCode, token, new Date());
  }
}
```

## `apps/api/src/booking/booking-hold-status.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\booking-hold-status.controller.ts`
- Lines: 16

### Top-level declarations / exports

- `export class BookingHoldStatusController`

### Function / method signatures

- `public getStatus(@Body() body: unknown)`

### Database tables / schema references

- `import { Body, Controller, Inject, Post, Version } from '@nestjs/common';`
- `import { BookingHoldStatusService } from './services/booking-hold-status.service.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `return this.status.status(body, new Date());`

### Money / arithmetic operations

- `@Controller('public/booking-holds')`
- `import { Body, Controller, Inject, Post, Version } from '@nestjs/common';`
- `import { BookingHoldStatusService } from './services/booking-hold-status.service.js';`

### Routing decorators / endpoint declarations

- `@Controller('public/booking-holds')`
- `@Post('status')`
- `@Version('1')`

### Verbatim source

```typescript
import { Body, Controller, Inject, Post, Version } from '@nestjs/common';

import { BookingHoldStatusService } from './services/booking-hold-status.service.js';

@Controller('public/booking-holds')
export class BookingHoldStatusController {
  public constructor(
    @Inject(BookingHoldStatusService) private readonly status: BookingHoldStatusService,
  ) {}

  @Post('status')
  @Version('1')
  public getStatus(@Body() body: unknown) {
    return this.status.status(body, new Date());
  }
}
```

## `apps/api/src/booking/booking-hold.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\booking-hold.controller.ts`
- Lines: 44

### Top-level declarations / exports

- `export class BookingHoldController`
- `interface RequestWithCorrelation`

### Function / method signatures

- None detected by static scan.

### Database tables / schema references

- `* valid session. Guest bookings remain the default; absence of a CUSTOMER`
- `@Controller('public/quotes')`
- `@Post(':quoteId/bookings')`
- `import { Body, Controller, Inject, Param, Post, Req, Version } from '@nestjs/common';`
- `import { BookingHoldService } from './services/booking-hold.service.js';`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `* Resolve an ACTIVE CUSTOMER user id only when the request carries a`
- `* session is intentionally non-fatal here.`
- `* valid session. Guest bookings remain the default; absence of a CUSTOMER`
- `*/`
- `/**`
- `@Controller('public/quotes')`
- `@Post(':quoteId/bookings')`
- `import { Body, Controller, Inject, Param, Post, Req, Version } from '@nestjs/common';`
- `import { BookingHoldService } from './services/booking-hold.service.js';`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`

### Routing decorators / endpoint declarations

- `@Body() body: unknown,`
- `@Controller('public/quotes')`
- `@Param('quoteId') quoteId: string,`
- `@Post(':quoteId/bookings')`
- `@Req() request: RequestWithCorrelation,`
- `@Version('1')`

### Verbatim source

```typescript
import { Body, Controller, Inject, Param, Post, Req, Version } from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import { BookingHoldService } from './services/booking-hold.service.js';

interface RequestWithCorrelation {
  readonly id: string;
  readonly headers: Record<string, string | string[] | undefined>;
}

@Controller('public/quotes')
export class BookingHoldController {
  public constructor(
    @Inject(BookingHoldService) private readonly holds: BookingHoldService,
    @Inject(CustomerSessionService) private readonly customers: CustomerSessionService,
  ) {}

  @Post(':quoteId/bookings')
  @Version('1')
  public async issue(
    @Param('quoteId') quoteId: string,
    @Body() body: unknown,
    @Req() request: RequestWithCorrelation,
  ) {
    const customerUserId = await this.resolveOptionalCustomerUserId(request);
    return this.holds.issue(quoteId, body, request.id, customerUserId);
  }

  /**
   * Resolve an ACTIVE CUSTOMER user id only when the request carries a
   * valid session. Guest bookings remain the default; absence of a CUSTOMER
   * session is intentionally non-fatal here.
   */
  private async resolveOptionalCustomerUserId(
    request: RequestWithCorrelation,
  ): Promise<string | undefined> {
    try {
      const actor = await this.customers.requireCustomer(request);
      return actor.userId;
    } catch {
      return undefined;
    }
  }
}
```

## `apps/api/src/booking/booking.module.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\booking.module.ts`
- Lines: 182

### Top-level declarations / exports

- `export class BookingModule`
- `export const GUEST_RATE_LIMIT_CONFIG`
- `export const GUEST_SECRETS`

### Function / method signatures

- None detected by static scan.

### Database tables / schema references

- `import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';`
- `import { AdminBookingOperationsController } from './admin-booking-operations.controller.js';`
- `import { AdminBookingRepository } from './repositories/admin-booking.repository.js';`
- `import { AppDatabaseModule } from '../database/database.module.js';`
- `import { AuthModule } from '../auth/auth.module.js';`
- `import { BookingDetailController } from './booking-detail.controller.js';`
- `import { BookingDetailRepository } from './repositories/booking-detail.repository.js';`
- `import { BookingDetailService } from './services/booking-detail.service.js';`
- `import { BookingHoldController } from './booking-hold.controller.js';`
- `import { BookingHoldService } from './services/booking-hold.service.js';`
- `import { BookingHoldStatusController } from './booking-hold-status.controller.js';`
- `import { BookingHoldStatusService } from './services/booking-hold-status.service.js';`
- `import { DatabaseProvider } from '../database/database.provider.js';`
- `import { GuestAccessLogoutController } from './guest-access-logout.controller.js';`
- `import { GuestAccessOtpController } from './guest-access-otp.controller.js';`
- `import { GuestAccessOtpRequestService } from './services/guest-access-otp-request.service.js';`
- `import { GuestAccessOtpVerifyService } from './services/guest-access-otp-verify.service.js';`
- `import { GuestLogoutService } from './services/guest-logout.service.js';`
- `import { GuestSessionRepository } from './repositories/guest-session.repository.js';`
- `import { GuestSessionService } from './services/guest-session.service.js';`
- `import { Module } from '@nestjs/common';`
- `import { PropertyContextService } from '../catalog/property-context.service.js';`
- `import { loadGuestSecrets, type GuestSecrets } from './secrets.js';`
- `import { type DatabasePool } from '@room/database';`
- `} from './repositories/guest-access.repository.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';`
- `import { AdminBookingOperationsController } from './admin-booking-operations.controller.js';`
- `import { AdminBookingRepository } from './repositories/admin-booking.repository.js';`
- `import { AppDatabaseModule } from '../database/database.module.js';`
- `import { AuthModule } from '../auth/auth.module.js';`
- `import { BookingDetailController } from './booking-detail.controller.js';`
- `import { BookingDetailRepository } from './repositories/booking-detail.repository.js';`
- `import { BookingDetailService } from './services/booking-detail.service.js';`
- `import { BookingHoldController } from './booking-hold.controller.js';`
- `import { BookingHoldService } from './services/booking-hold.service.js';`
- `import { BookingHoldStatusController } from './booking-hold-status.controller.js';`
- `import { BookingHoldStatusService } from './services/booking-hold-status.service.js';`
- `import { DatabaseProvider } from '../database/database.provider.js';`
- `import { GuestAccessLogoutController } from './guest-access-logout.controller.js';`
- `import { GuestAccessOtpController } from './guest-access-otp.controller.js';`
- `import { GuestAccessOtpRequestService } from './services/guest-access-otp-request.service.js';`
- `import { GuestAccessOtpVerifyService } from './services/guest-access-otp-verify.service.js';`
- `import { GuestLogoutService } from './services/guest-logout.service.js';`
- `import { GuestSessionRepository } from './repositories/guest-session.repository.js';`
- `import { GuestSessionService } from './services/guest-session.service.js';`
- `import { Module } from '@nestjs/common';`
- `import { PropertyContextService } from '../catalog/property-context.service.js';`
- `import { loadGuestSecrets, type GuestSecrets } from './secrets.js';`
- `import { type DatabasePool } from '@room/database';`
- `} from './repositories/guest-access.repository.js';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Module } from '@nestjs/common';
import { type DatabasePool } from '@room/database';

import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { AdminBookingOperationsController } from './admin-booking-operations.controller.js';
import { BookingDetailController } from './booking-detail.controller.js';
import { BookingHoldController } from './booking-hold.controller.js';
import { BookingHoldStatusController } from './booking-hold-status.controller.js';
import { GuestAccessLogoutController } from './guest-access-logout.controller.js';
import { GuestAccessOtpController } from './guest-access-otp.controller.js';
import { AdminBookingRepository } from './repositories/admin-booking.repository.js';
import { BookingDetailRepository } from './repositories/booking-detail.repository.js';
import {
  GuestAccessRepository,
  type GuestAccessRateLimitConfig,
} from './repositories/guest-access.repository.js';
import { GuestSessionRepository } from './repositories/guest-session.repository.js';
import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';
import { BookingDetailService } from './services/booking-detail.service.js';
import { BookingHoldService } from './services/booking-hold.service.js';
import { BookingHoldStatusService } from './services/booking-hold-status.service.js';
import { GuestAccessOtpRequestService } from './services/guest-access-otp-request.service.js';
import { GuestAccessOtpVerifyService } from './services/guest-access-otp-verify.service.js';
import { GuestLogoutService } from './services/guest-logout.service.js';
import { GuestSessionService } from './services/guest-session.service.js';
import { loadGuestSecrets, type GuestSecrets } from './secrets.js';

export const GUEST_SECRETS = Symbol('GUEST_SECRETS');
export const GUEST_RATE_LIMIT_CONFIG = Symbol('GUEST_RATE_LIMIT_CONFIG');

@Module({
  imports: [AppDatabaseModule, AuthModule],
  controllers: [
    BookingHoldController,
    GuestAccessOtpController,
    BookingDetailController,
    BookingHoldStatusController,
    GuestAccessLogoutController,
    AdminBookingOperationsController,
  ],
  providers: [
    {
      provide: GUEST_SECRETS,
      useFactory: (): GuestSecrets =>
        loadGuestSecrets({
          GUEST_OTP_SECRET: process.env.GUEST_OTP_SECRET ?? '',
          GUEST_CHALLENGE_REF_SECRET: process.env.GUEST_CHALLENGE_REF_SECRET ?? '',
          GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET ?? '',
          BOOKING_IP_DIGEST_SECRET: process.env.BOOKING_IP_DIGEST_SECRET ?? '',
        }),
    },
    {
      provide: GUEST_RATE_LIMIT_CONFIG,
      useFactory: (): GuestAccessRateLimitConfig => ({
        requestWindowMs: Number(process.env.GUEST_OTP_REQUEST_WINDOW_MS ?? 900_000),
        requestLimit: Number(process.env.GUEST_OTP_REQUEST_LIMIT ?? 3),
        ipWindowMs: Number(process.env.GUEST_OTP_IP_WINDOW_MS ?? 3_600_000),
        ipLimit: Number(process.env.GUEST_OTP_IP_LIMIT ?? 20),
        resendCooldownMs: Number(process.env.GUEST_OTP_RESEND_COOLDOWN_MS ?? 60_000),
        otpTtlMs: Number(process.env.GUEST_OTP_TTL_MS ?? 600_000),
        sessionTtlMs: Number(process.env.GUEST_SESSION_TTL_MS ?? 1_800_000),
      }),
    },
    {
      provide: GuestAccessRepository,
      inject: [DatabaseProvider, GUEST_SECRETS, GUEST_RATE_LIMIT_CONFIG],
      useFactory: (
        database: DatabaseProvider,
        secrets: GuestSecrets,
        config: GuestAccessRateLimitConfig,
      ): GuestAccessRepository =>
        new GuestAccessRepository(
          database.pool as unknown as DatabasePool,
          database.client,
          secrets,
          config,
        ),
    },
    {
      provide: GuestSessionRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): GuestSessionRepository =>
        new GuestSessionRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: BookingDetailRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): BookingDetailRepository =>
        new BookingDetailRepository(database.client),
    },
    {
      provide: BookingHoldService,
      inject: [DatabaseProvider, GUEST_SECRETS],
      useFactory: (database: DatabaseProvider, secrets: GuestSecrets): BookingHoldService =>
        new BookingHoldService({
          pool: database.pool as unknown as DatabasePool,
          holdDurationMs: Number(process.env.BOOKING_HOLD_DURATION_MS ?? 900_000),
          ipDigestSecret: secrets.ipDigestSecret,
        }),
    },
    {
      provide: GuestSessionService,
      inject: [GuestSessionRepository, GUEST_SECRETS],
      useFactory: (
        repository: GuestSessionRepository,
        secrets: GuestSecrets,
      ): GuestSessionService => new GuestSessionService(repository, secrets),
    },
    {
      provide: GuestAccessOtpRequestService,
      inject: [GuestAccessRepository, GUEST_SECRETS, GUEST_RATE_LIMIT_CONFIG],
      useFactory: (
        repository: GuestAccessRepository,
        secrets: GuestSecrets,
        config: GuestAccessRateLimitConfig,
      ): GuestAccessOtpRequestService =>
        new GuestAccessOtpRequestService(repository, secrets, config),
    },
    {
      provide: GuestAccessOtpVerifyService,
      inject: [GuestAccessRepository, GUEST_SECRETS],
      useFactory: (
        repository: GuestAccessRepository,
        secrets: GuestSecrets,
      ): GuestAccessOtpVerifyService => new GuestAccessOtpVerifyService(repository, secrets),
    },
    {
      provide: BookingDetailService,
      inject: [BookingDetailRepository, GuestSessionService],
      useFactory: (
        repository: BookingDetailRepository,
        session: GuestSessionService,
      ): BookingDetailService => new BookingDetailService(repository, session),
    },
    {
      provide: BookingHoldStatusService,
      inject: [DatabaseProvider, GUEST_SECRETS],
      useFactory: (database: DatabaseProvider, secrets: GuestSecrets): BookingHoldStatusService =>
        new BookingHoldStatusService(database.client, secrets),
    },
    {
      provide: GuestLogoutService,
      inject: [GuestAccessRepository, GuestSessionService],
      useFactory: (
        repository: GuestAccessRepository,
        session: GuestSessionService,
      ): GuestLogoutService => new GuestLogoutService(repository, session),
    },
    {
      provide: PropertyContextService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): PropertyContextService =>
        new PropertyContextService(database.client),
    },
    {
      provide: AdminBookingRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): AdminBookingRepository =>
        new AdminBookingRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: AdminBookingLifecycleService,
      inject: [DatabaseProvider, AdminBookingRepository],
      useFactory: (
        database: DatabaseProvider,
        repository: AdminBookingRepository,
      ): AdminBookingLifecycleService =>
        new AdminBookingLifecycleService(database.pool as unknown as DatabasePool, repository),
    },
  ],
  exports: [
    BookingDetailRepository,
    GuestSessionService,
    AdminBookingLifecycleService,
    AdminBookingRepository,
    PropertyContextService,
  ],
})
export class BookingModule {}
```

## `apps/api/src/booking/cookie.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\cookie.ts`
- Lines: 89

### Top-level declarations / exports

- `export const GUEST_SESSION_COOKIE_NAME`
- `export function buildClearCookieHeader(`
- `export function parseGuestSessionCookie(rawValue: string): Buffer | null`
- `export function serializeGuestSessionCookie(`
- `export function serializeGuestSessionExpiry(`
- `export interface GuestSessionCookieAttributes`
- `export interface SerializedCookie`
- `function base64UrlDecode(value: string): Buffer | null`
- `function base64UrlEncode(buffer: Buffer): string`

### Function / method signatures

- `export function parseGuestSessionCookie(rawValue: string)`
- `function base64UrlDecode(value: string)`
- `function base64UrlEncode(buffer: Buffer)`
- `if (secureFlag)`

### Database tables / schema references

- `import { Buffer } from 'node:buffer';`
- `return Buffer.from(value, 'base64url');`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `*`
- `* Attributes: HttpOnly, SameSite=Lax, Path=/, Secure in production,`
- `* Cookie serialization / parsing for the Phase 5 guest session cookie.`
- `* Max-Age = \`GUEST_SESSION_TTL_MS / 1000\` (default 1800s).`
- `* Name: \`rm_guest_session_v1\``
- `* The cookie payload is the base64url-encoded raw session token; only`
- `* the SHA-256 digest of that token is stored in the database.`
- `*/`
- `/**`
- `\`Path=${attributes.path ?? '/'}\`,`
- `const maxAge = Math.max(0, Math.floor(attributes.ttlSeconds));`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
/**
 * Cookie serialization / parsing for the Phase 5 guest session cookie.
 *
 * Name: `rm_guest_session_v1`
 * Attributes: HttpOnly, SameSite=Lax, Path=/, Secure in production,
 * Max-Age = `GUEST_SESSION_TTL_MS / 1000` (default 1800s).
 *
 * The cookie payload is the base64url-encoded raw session token; only
 * the SHA-256 digest of that token is stored in the database.
 */

import { Buffer } from 'node:buffer';

export interface GuestSessionCookieAttributes {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly ttlSeconds: number;
  readonly path?: string;
}

export const GUEST_SESSION_COOKIE_NAME = 'rm_guest_session_v1';

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function base64UrlDecode(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

export interface SerializedCookie {
  readonly name: string;
  readonly value: string;
  readonly header: string;
}

export function serializeGuestSessionCookie(
  token: Buffer,
  attributes: GuestSessionCookieAttributes,
): SerializedCookie {
  const value = base64UrlEncode(token);
  const secureFlag = attributes.nodeEnv === 'production';
  const maxAge = Math.max(0, Math.floor(attributes.ttlSeconds));
  const parts = [
    `${GUEST_SESSION_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${attributes.path ?? '/'}`,
    `Max-Age=${maxAge}`,
  ];
  if (secureFlag) {
    parts.push('Secure');
  }
  return {
    name: GUEST_SESSION_COOKIE_NAME,
    value,
    header: parts.join('; '),
  };
}

export function parseGuestSessionCookie(rawValue: string): Buffer | null {
  return base64UrlDecode(rawValue);
}

export function serializeGuestSessionExpiry(
  attributes: GuestSessionCookieAttributes,
): SerializedCookie {
  return serializeGuestSessionCookie(Buffer.alloc(0), attributes);
}

export function buildClearCookieHeader(attributes: GuestSessionCookieAttributes): string {
  const secureFlag = attributes.nodeEnv === 'production';
  const parts = [
    `${GUEST_SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${attributes.path ?? '/'}`,
    'Max-Age=0',
  ];
  if (secureFlag) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
```

## `apps/api/src/booking/guest-access-logout.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\guest-access-logout.controller.ts`
- Lines: 40

### Top-level declarations / exports

- `export class GuestAccessLogoutController`
- `interface RequestLike`

### Function / method signatures

- `buildClearCookieHeader(attributes)`

### Database tables / schema references

- `import type { FastifyReply } from 'fastify';`
- `import { Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';`
- `import { GuestLogoutService } from './services/guest-logout.service.js';`
- `} from './cookie.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const result = await this.service.logout(token, new Date());`

### Money / arithmetic operations

- `@Controller('public/guest-access')`
- `import { Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';`
- `import { GuestLogoutService } from './services/guest-logout.service.js';`
- `} from './cookie.js';`

### Routing decorators / endpoint declarations

- `@Controller('public/guest-access')`
- `@Post('logout')`
- `@Req() request: RequestLike,`
- `@Res({ passthrough: true }) reply: FastifyReply,`
- `@Version('1')`

### Verbatim source

```typescript
import { Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import {
  buildClearCookieHeader,
  parseGuestSessionCookie,
  type GuestSessionCookieAttributes,
} from './cookie.js';
import { GuestLogoutService } from './services/guest-logout.service.js';

interface RequestLike {
  readonly cookies?: Record<string, string | undefined>;
}

@Controller('public/guest-access')
export class GuestAccessLogoutController {
  public constructor(@Inject(GuestLogoutService) private readonly service: GuestLogoutService) {}

  @Post('logout')
  @Version('1')
  public async logout(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    const token = raw === undefined || raw === '' ? null : parseGuestSessionCookie(raw);
    const attributes: GuestSessionCookieAttributes = {
      nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      ttlSeconds: 1800,
    };
    const result = await this.service.logout(token, new Date());
    (reply as unknown as { header: (name: string, value: string) => void }).header(
      'Set-Cookie',
      buildClearCookieHeader(attributes),
    );
    return result;
  }
}
```

## `apps/api/src/booking/guest-access-otp.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\guest-access-otp.controller.ts`
- Lines: 108

### Top-level declarations / exports

- `class OtpRateLimitedHttpError extends Error`
- `export class GuestAccessOtpController`
- `function extractIp(request: RequestLike, _trustedCidrs: readonly`
- `function readSessionCookie(request: RequestLike): Buffer | null`
- `interface ReplyWithSetCookie`
- `interface RequestLike`

### Function / method signatures

- `extractIp(request, [])`
- `function extractIp(request: RequestLike, _trustedCidrs: readonly { readonly cidr: string }[])`
- `function readSessionCookie(request: RequestLike)`
- `if (error instanceof OtpInvalidOrExpiredError)`
- `if (error instanceof OtpRateLimitedError)`
- `if (raw === undefined || raw === '')`
- `public async requestOtp(@Body() body: unknown, @Req() request: RequestLike)`
- `public constructor(public readonly retryAfterSeconds: number)`
- `super('OTP rate-limited')`

### Database tables / schema references

- `import type { FastifyReply } from 'fastify';`
- `import { Body, Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';`
- `import { Buffer } from 'node:buffer';`
- `import { GuestAccessOtpRequestService, OtpRateLimitedError } from './services/guest-access-otp-request.service.js';`
- `} from './cookie.js';`
- `} from './services/guest-access-otp-verify.service.js';`

### External HTTP calls

- `return await this.requestService.request(body, extractIp(request, []));`

### Timezone / date handling

- `new Date(),`

### Money / arithmetic operations

- `// Without trusted proxies we fall back to socket address (no spoofable`
- `// hook level when the deploy wants to honour X-Forwarded-For.`
- `// surface). TRUSTED_PROXY_CIDRS handling is enforced at the Fastify`
- `@Controller('public/guest-access')`
- `@Post('otp/request')`
- `@Post('otp/verify')`
- `import { Body, Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';`
- `import { GuestAccessOtpRequestService, OtpRateLimitedError } from './services/guest-access-otp-request.service.js';`
- `} from './cookie.js';`
- `} from './services/guest-access-otp-verify.service.js';`

### Routing decorators / endpoint declarations

- `@Body() body: unknown,`
- `@Controller('public/guest-access')`
- `@Post('otp/request')`
- `@Post('otp/verify')`
- `@Req() request: RequestLike,`
- `@Res({ passthrough: true }) reply: FastifyReply,`
- `@Version('1')`

### Verbatim source

```typescript
import { Body, Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Buffer } from 'node:buffer';

import {
  buildClearCookieHeader,
  parseGuestSessionCookie,
  serializeGuestSessionCookie,
  type GuestSessionCookieAttributes,
} from './cookie.js';
import {
  GuestAccessOtpRequestService,
  OtpRateLimitedError,
} from './services/guest-access-otp-request.service.js';
import {
  GuestAccessOtpVerifyService,
  OtpInvalidOrExpiredError,
} from './services/guest-access-otp-verify.service.js';

interface RequestLike {
  readonly id: string;
  readonly cookies?: Record<string, string | undefined>;
  readonly socket?: { readonly remoteAddress?: string | null } | null;
  readonly headers?: Record<string, string | string[] | undefined>;
}

interface ReplyWithSetCookie {
  readonly header: (name: string, value: string) => ReplyWithSetCookie;
}

function readSessionCookie(request: RequestLike): Buffer | null {
  const raw = request.cookies?.['rm_guest_session_v1'];
  if (raw === undefined || raw === '') return null;
  return parseGuestSessionCookie(raw);
}

function extractIp(
  request: RequestLike,
  _trustedCidrs: readonly { readonly cidr: string }[],
): string {
  const socketAddress = request.socket?.remoteAddress ?? null;
  // Without trusted proxies we fall back to socket address (no spoofable
  // surface). TRUSTED_PROXY_CIDRS handling is enforced at the Fastify
  // hook level when the deploy wants to honour X-Forwarded-For.
  void _trustedCidrs;
  return socketAddress ?? '127.0.0.1';
}

@Controller('public/guest-access')
export class GuestAccessOtpController {
  public constructor(
    @Inject(GuestAccessOtpRequestService)
    private readonly requestService: GuestAccessOtpRequestService,
    @Inject(GuestAccessOtpVerifyService)
    private readonly verifyService: GuestAccessOtpVerifyService,
  ) {}

  @Post('otp/request')
  @Version('1')
  public async requestOtp(@Body() body: unknown, @Req() request: RequestLike) {
    try {
      return await this.requestService.request(body, extractIp(request, []));
    } catch (error) {
      if (error instanceof OtpRateLimitedError) {
        const response = error as OtpRateLimitedError & {
          readonly retryAfterSeconds: number;
        };
        throw new OtpRateLimitedHttpError(response.retryAfterSeconds);
      }
      throw error;
    }
  }

  @Post('otp/verify')
  @Version('1')
  public async verifyOtp(
    @Body() body: unknown,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      const { response, sessionToken } = await this.verifyService.verify(
        body,
        extractIp(request, []),
        new Date(),
      );
      const attributes: GuestSessionCookieAttributes = {
        nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        ttlSeconds: 1800,
      };
      const cookie = serializeGuestSessionCookie(sessionToken, attributes);
      (reply as unknown as ReplyWithSetCookie).header('Set-Cookie', cookie.header);
      return response;
    } catch (error) {
      if (error instanceof OtpInvalidOrExpiredError) {
        throw error;
      }
      throw error;
    }
  }
}

class OtpRateLimitedHttpError extends Error {
  public readonly status = 429;
  public readonly code = 'OTP_RATE_LIMITED';
  public constructor(public readonly retryAfterSeconds: number) {
    super('OTP rate-limited');
    this.name = 'OtpRateLimitedHttpError';
  }
}

void readSessionCookie;
void buildClearCookieHeader;
```

## `apps/api/src/booking/ip.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\ip.ts`
- Lines: 107

### Top-level declarations / exports

- `const CIDR_REGEX`
- `export function extractRequestIp(`
- `export function parseCidrList(value: string): ProxyCidrEntry[]`
- `export interface ProxyCidrEntry`
- `export interface RequestLike`
- `export type RawIp`
- `function firstForwardedFor(header: string | string[] | undefined): RawIp | null`
- `function ipMatchesCidr(ip: string, cidr: string): boolean`
- `function ipv4ToInt(value: string): number | null`
- `function parseCidrOrThrow(cidr: string): ProxyCidrEntry`

### Function / method signatures

- `export function parseCidrList(value: string)`
- `for (const byte of bytes)`
- `for (const entry of trustedCidrs)`
- `function firstForwardedFor(header: string | string[] | undefined)`
- `function ipMatchesCidr(ip: string, cidr: string)`
- `function ipv4ToInt(value: string)`
- `function parseCidrOrThrow(cidr: string)`
- `if (!Number.isInteger(byte) || byte < 0 || byte > 255)`
- `if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32)`
- `if (Array.isArray(header) && header.length > 0)`
- `if (candidate !== null && socketAddress !== null)`
- `if (ipInt === null || cidrInt === null)`
- `if (ipMatchesCidr(socketAddress, entry.cidr))`
- `if (match === null)`
- `if (octets.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255))`
- `if (prefixLength === 0)`
- `if (typeof head === 'string')`
- `if (typeof header === 'string')`
- `return ((octets[0] ?? 0) << 24) | ((octets[1] ?? 0) << 16) | ((octets[2] ?? 0) << 8) | (octets[3] ?? 0)`
- `return (ipInt & mask) === (cidrInt & mask)`

### Database tables / schema references

- None detected by static scan.

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `*`
- `* Extract the client IP for rate-limit/audit use.`
- `* Production must be deployed behind a known trusted proxy. The CIDR`
- `* client can spoof the source IP and escape the rate-limit window. When`
- `* list is the only way \`X-Forwarded-For\` can be trusted — otherwise the`
- `* no proxy CIDR matches, we fall back to the socket address (no`
- `* spoofable surface).`
- `*/`
- `/**`
- `const CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;`
- `const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value);`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
/**
 * Extract the client IP for rate-limit/audit use.
 *
 * Production must be deployed behind a known trusted proxy. The CIDR
 * list is the only way `X-Forwarded-For` can be trusted — otherwise the
 * client can spoof the source IP and escape the rate-limit window. When
 * no proxy CIDR matches, we fall back to the socket address (no
 * spoofable surface).
 */

export type RawIp = string;

export interface RequestLike {
  readonly socket?: { readonly remoteAddress?: string | null } | null;
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly ip?: string;
}

export interface ProxyCidrEntry {
  readonly cidr: string;
}

const CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

export function parseCidrList(value: string): ProxyCidrEntry[] {
  return value
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw !== '')
    .map((raw) => parseCidrOrThrow(raw));
}

function parseCidrOrThrow(cidr: string): ProxyCidrEntry {
  const match = CIDR_REGEX.exec(cidr);
  if (match === null) {
    throw new RangeError(`Invalid CIDR: ${cidr}`);
  }
  const [, ...parts] = match;
  const bytes = parts.slice(0, 4).map((value) => Number(value));
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new RangeError(`Invalid CIDR octet in: ${cidr}`);
    }
  }
  const prefixLength = Number(parts[4]);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new RangeError(`Invalid CIDR prefix length in: ${cidr}`);
  }
  return { cidr };
}

function ipv4ToInt(value: string): number | null {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (match === null) return null;
  const octets = [match[1], match[2], match[3], match[4]].map((part) => Number(part));
  if (octets.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return null;
  }
  return (
    ((octets[0] ?? 0) << 24) | ((octets[1] ?? 0) << 16) | ((octets[2] ?? 0) << 8) | (octets[3] ?? 0)
  );
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const match = CIDR_REGEX.exec(cidr);
  if (match === null) return false;
  const prefixLength = Number(match[5]);
  const ipInt = ipv4ToInt(ip);
  const cidrInt = ipv4ToInt(`${match[1]}.${match[2]}.${match[3]}.${match[4]}`);
  if (ipInt === null || cidrInt === null) return false;
  if (prefixLength === 0) return true;
  const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) === (cidrInt & mask);
}

function firstForwardedFor(header: string | string[] | undefined): RawIp | null {
  if (typeof header === 'string') {
    const first = header.split(',')[0]?.trim();
    return first === undefined || first === '' ? null : first;
  }
  if (Array.isArray(header) && header.length > 0) {
    const head = header[0];
    if (typeof head === 'string') {
      const first = head.split(',')[0]?.trim();
      return first === undefined || first === '' ? null : first;
    }
  }
  return null;
}

export function extractRequestIp(
  request: RequestLike,
  trustedCidrs: readonly ProxyCidrEntry[],
): RawIp | null {
  const socketAddress = request.socket?.remoteAddress ?? request.ip ?? null;

  const forwardedFor = request.headers?.['x-forwarded-for'];
  const candidate = firstForwardedFor(forwardedFor);

  if (candidate !== null && socketAddress !== null) {
    for (const entry of trustedCidrs) {
      if (ipMatchesCidr(socketAddress, entry.cidr)) {
        return candidate;
      }
    }
  }

  return socketAddress;
}
```

## `apps/api/src/booking/repositories/admin-booking.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\repositories\admin-booking.repository.ts`
- Lines: 734

### Top-level declarations / exports

- `const SAFE_PAYLOAD_KEYS`
- `export class AdminBookingRepository`
- `export interface AdminBookingDetailCoupon`
- `export interface AdminBookingDetailRow extends AdminBookingListRow`
- `export interface AdminBookingListRow`
- `export interface AdminBookingTimelineRow`
- `export interface AdminOperationalReviewDetailRow extends AdminOperationalReviewSummaryRow`
- `export interface AdminOperationalReviewSummaryRow`
- `export type AdminBookingStatus`
- `export type AdminPaymentStatusSummary`
- `export type AdminReviewPresence`
- `function asBigInt(value: string | number | bigint, _field: string): bigint`
- `function asDate(value: Date | string, field: string): Date`
- `function asOptionalDate(value: Date | string | null, field: string): Date | null`
- `function buildListFilters(`
- `function paymentStatusSummary(value: string | null): AdminPaymentStatusSummary`
- `function readDetailCoupon(row: AdminBookingDetailDbRow): AdminBookingDetailCoupon | null`
- `function reviewPresence(value: string | null): AdminReviewPresence`
- `function sanitizePayload(payload: unknown): Record<string, unknown>`
- `function toAdminBookingDetailRow(row: AdminBookingDetailDbRow): AdminBookingDetailRow`
- `function toAdminBookingListRow(row: AdminBookingListDbRow): AdminBookingListRow`
- `function toAdminOperationalReviewDetailRow(`
- `function toAdminOperationalReviewSummaryRow(`
- `interface AdminBookingDetailDbRow extends AdminBookingListDbRow`
- `interface AdminBookingListDbRow`
- `interface AdminOperationalReviewDbRow`
- `interface ListFilters`

### Function / method signatures

- `for (const [key, value] of Object.entries(payload as Record<string, unknown>))`
- `function asBigInt(value: string | number | bigint, _field: string)`
- `function asDate(value: Date | string, field: string)`
- `function asOptionalDate(value: Date | string | null, field: string)`
- `function paymentStatusSummary(value: string | null)`
- `function readDetailCoupon(row: AdminBookingDetailDbRow)`
- `function reviewPresence(value: string | null)`
- `function sanitizePayload(payload: unknown)`
- `function toAdminBookingDetailRow(row: AdminBookingDetailDbRow)`
- `function toAdminBookingListRow(row: AdminBookingListDbRow)`
- `if (Number.isNaN(parsed.getTime()))`
- `if (SAFE_PAYLOAD_KEYS.has(key))`
- `if (query.bookingCode !== undefined)`
- `if (query.checkInFrom !== undefined)`
- `if (query.checkInTo !== undefined)`
- `if (query.paymentStatus !== undefined)`
- `if (query.paymentStatus === 'NONE')`
- `if (query.q !== undefined)`
- `if (query.reviewPresence === 'open')`
- `if (query.roomTypeId !== undefined)`
- `if (query.status !== undefined)`
- `if (row === undefined)`
- `if (row.coupon_code === null || row.coupon_discount_type === null)`
- `if (typeof payload !== 'object' || payload === null)`
- `if (typeof value === 'bigint')`
- `if (typeof value === 'number') return BigInt(value)`
- `if (value === 'OPEN')`
- `if (value === 'RESOLVED')`
- `if (value === null)`
- `if (value instanceof Date)`
- `public constructor(private readonly pool: DatabasePool)`

### Database tables / schema references

- `FROM audit_events`
- `FROM bookings b`
- `FROM operational_reviews`
- `FROM operational_reviews rv`
- `JOIN booking_contacts bc ON bc.booking_id = b.id`
- `JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id`
- `JOIN properties p ON p.id = b.property_id`
- `JOIN room_types rt`
- `JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id`
- `LEFT JOIN LATERAL (`
- `LEFT JOIN booking_coupon_applications bca ON bca.booking_id = b.id`
- `LEFT JOIN payments pay ON pay.booking_id = b.id`
- `LEFT JOIN rooms r`
- `LEFT JOIN rooms r ON r.property_id = b.property_id AND r.id = b.room_id`
- `SELECT *`
- `SELECT COUNT(*)::text AS count`
- `SELECT b.id              AS booking_id,`
- `SELECT rv.id              AS review_id,`
- `\`EXISTS (SELECT 1 FROM operational_reviews rv2 WHERE rv2.booking_id = b.id AND rv2.status = 'RESOLVED')\`,`
- `\`NOT EXISTS (SELECT 1 FROM operational_reviews rv3 WHERE rv3.booking_id = b.id)\`,`
- `\`SELECT b.id AS booking_id,`
- `\`SELECT id, event_type, actor_type, actor_id, occurred_at, payload`
- `\`SELECT rv.id AS review_id,`
- `if (query.checkInFrom !== undefined) {`
- `if (query.checkInTo !== undefined) {`
- `import type { DatabasePool } from '@room/database';`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const parsed = new Date(value);`
- `params.push(new Date(query.checkInFrom));`
- `params.push(new Date(query.checkInTo));`

### Money / arithmetic operations

- `: asBigInt(row.payment_amount_vnd, 'payment_amount_vnd'),`
- `SELECT *`
- `SELECT COUNT(*)::text AS count`
- `b.price_snapshot           AS price_snapshot,`
- `const offset = (query.page - 1) * query.pageSize;`
- `discountAmountVnd: asBigInt(row.coupon_discount_amount_vnd, 'coupon_discount_amount_vnd'),`
- `discountAmountVnd: asBigInt(row.discount_amount_vnd, 'discount_amount_vnd'),`
- `finalAmountVnd: asBigInt(row.coupon_final_amount_vnd, 'coupon_final_amount_vnd'),`
- `finalAmountVnd: asBigInt(row.final_amount_vnd, 'final_amount_vnd'),`
- `function asBigInt(value: string | number | bigint, _field: string): bigint {`
- `grossAmountVnd: asBigInt(row.coupon_gross_amount_vnd, 'coupon_gross_amount_vnd'),`
- `grossAmountVnd: asBigInt(row.gross_amount_vnd, 'gross_amount_vnd'),`
- `if (typeof value === 'number') return BigInt(value);`
- `import type { DatabasePool } from '@room/database';`
- `paymentAmountVnd:`
- `priceSnapshot: row.price_snapshot,`
- `price_snapshot: unknown;`
- `readonly discountAmountVnd: bigint;`
- `readonly finalAmountVnd: bigint;`
- `readonly grossAmountVnd: bigint;`
- `readonly paymentAmountVnd: bigint | null;`
- `readonly priceSnapshot: unknown;`
- `return BigInt(value);`
- `row.payment_amount_vnd === null ? null : asBigInt(row.payment_amount_vnd, 'payment_amount_vnd'),`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import type { DatabasePool } from '@room/database';

import type { AdminBookingListQuery, AdminOperationalReviewListQuery } from '@room/contracts';

export type AdminBookingStatus =
  'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';

export type AdminPaymentStatusSummary =
  'NONE' | 'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';

export type AdminReviewPresence = 'OPEN' | 'RESOLVED' | 'NONE';

export interface AdminBookingListRow {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly propertyId: string;
  readonly status: AdminBookingStatus;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly finalAmountVnd: bigint;
  readonly currency: 'VND';
  readonly createdAt: Date;
  readonly roomTypeId: string;
  readonly roomTypeCode: string;
  readonly roomTypeName: string;
  readonly roomId: string | null;
  readonly roomNumber: string | null;
  readonly fullName: string;
  readonly paymentStatus: AdminPaymentStatusSummary;
  readonly reviewPresence: AdminReviewPresence;
}

export interface AdminBookingDetailRow extends AdminBookingListRow {
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly propertyTimezone: string;
  readonly adults: number;
  readonly children: number;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly pricingRuleVersion: string | null;
  readonly priceSnapshot: unknown;
  readonly holdExpiresAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly checkedInAt: Date | null;
  readonly checkedOutAt: Date | null;
  readonly noShowAt: Date | null;
  readonly cancellationReason: string | null;
  readonly normalizedEmail: string;
  readonly normalizedPhoneE164: string;
  readonly maxOccupancy: number;
  readonly coupon: AdminBookingDetailCoupon | null;
  readonly paymentAmountVnd: bigint | null;
  readonly paymentConfirmationSource: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  readonly paymentSucceededAt: Date | null;
  readonly reviewId: string | null;
  readonly reviewCategory: 'PAID_CANCELLATION' | null;
  readonly reviewOpenedAt: Date | null;
  readonly reviewOpenedReason: string | null;
  readonly reviewResolvedAt: Date | null;
  readonly reviewResolvedNote: string | null;
}

export interface AdminBookingDetailCoupon {
  readonly code: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
}

export interface AdminBookingTimelineRow {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  readonly actorId: string | null;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export interface AdminOperationalReviewSummaryRow {
  readonly reviewId: string;
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly bookingStatus: AdminBookingStatus;
  readonly category: 'PAID_CANCELLATION';
  readonly status: 'OPEN' | 'RESOLVED';
  readonly openedAt: Date;
  readonly openedReason: string;
  readonly resolvedAt: Date | null;
  readonly resolvedNote: string | null;
  readonly finalAmountVnd: bigint;
  readonly currency: 'VND';
  readonly paymentStatus: AdminPaymentStatusSummary;
  readonly paymentAmountVnd: bigint | null;
  readonly paymentSucceededAt: Date | null;
  readonly paymentConfirmationSource: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  readonly roomId: string | null;
  readonly roomNumber: string | null;
  readonly roomTypeCode: string;
  readonly roomTypeName: string;
}

export interface AdminOperationalReviewDetailRow extends AdminOperationalReviewSummaryRow {
  readonly propertyId: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
}

interface AdminBookingListDbRow {
  booking_id: string;
  booking_code: string;
  property_id: string;
  status: AdminBookingStatus;
  check_in: Date | string;
  check_out: Date | string;
  final_amount_vnd: string | number | bigint;
  currency: 'VND';
  created_at: Date | string;
  room_type_id: string;
  room_type_code: string;
  room_type_name: string;
  room_id: string | null;
  room_number: string | null;
  full_name: string;
  payment_status: string | null;
  review_status: string | null;
}

interface AdminBookingDetailDbRow extends AdminBookingListDbRow {
  property_code: string;
  property_name: string;
  property_timezone: string;
  adults: number;
  children: number;
  gross_amount_vnd: string | number | bigint;
  discount_amount_vnd: string | number | bigint;
  pricing_rule_version: string | null;
  price_snapshot: unknown;
  hold_expires_at: Date | string | null;
  cancelled_at: Date | string | null;
  checked_in_at: Date | string | null;
  checked_out_at: Date | string | null;
  no_show_at: Date | string | null;
  cancellation_reason: string | null;
  normalized_email: string;
  normalized_phone_e164: string;
  max_occupancy: number;
  coupon_code: string | null;
  coupon_discount_type: 'FIXED' | 'PERCENTAGE' | null;
  coupon_gross_amount_vnd: string | number | bigint | null;
  coupon_discount_amount_vnd: string | number | bigint | null;
  coupon_final_amount_vnd: string | number | bigint | null;
  payment_amount_vnd: string | number | bigint | null;
  payment_confirmation_source: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  payment_succeeded_at: Date | string | null;
  review_id: string | null;
  review_category: 'PAID_CANCELLATION' | null;
  review_opened_at: Date | string | null;
  review_opened_reason: string | null;
  review_resolved_at: Date | string | null;
  review_resolved_note: string | null;
}

interface AdminOperationalReviewDbRow {
  review_id: string;
  booking_id: string;
  category: 'PAID_CANCELLATION';
  status: 'OPEN' | 'RESOLVED';
  opened_at: Date | string;
  opened_reason: string;
  resolved_at: Date | string | null;
  resolved_note: string | null;
  property_id?: string;
  booking_code: string;
  booking_status: AdminBookingStatus;
  check_in: Date | string;
  check_out: Date | string;
  final_amount_vnd: string | number | bigint;
  currency: 'VND';
  room_type_code: string;
  room_type_name: string;
  room_id: string | null;
  room_number: string | null;
  payment_amount_vnd: string | number | bigint | null;
  payment_status: string | null;
  payment_succeeded_at: Date | string | null;
  payment_confirmation_source: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
}

const SAFE_PAYLOAD_KEYS = new Set([
  'bookingCode',
  'from',
  'reason',
  'paid',
  'lateBySeconds',
  'reviewId',
  'category',
  'status',
  'note',
  'correlationId',
  'idempotencyKey',
]);

function asDate(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

function asOptionalDate(value: Date | string | null, field: string): Date | null {
  if (value === null) return null;
  return asDate(value, field);
}

function asBigInt(value: string | number | bigint, _field: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value);
}

function paymentStatusSummary(value: string | null): AdminPaymentStatusSummary {
  if (value === null) return 'NONE';
  if (
    value === 'PENDING' ||
    value === 'SUCCEEDED' ||
    value === 'REVIEW_REQUIRED' ||
    value === 'CANCELLED' ||
    value === 'EXPIRED'
  ) {
    return value;
  }
  return 'NONE';
}

function reviewPresence(value: string | null): AdminReviewPresence {
  if (value === 'OPEN') return 'OPEN';
  if (value === 'RESOLVED') return 'RESOLVED';
  return 'NONE';
}

function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SAFE_PAYLOAD_KEYS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function readDetailCoupon(row: AdminBookingDetailDbRow): AdminBookingDetailCoupon | null {
  if (row.coupon_code === null || row.coupon_discount_type === null) return null;
  if (
    row.coupon_gross_amount_vnd === null ||
    row.coupon_discount_amount_vnd === null ||
    row.coupon_final_amount_vnd === null
  ) {
    return null;
  }
  return {
    code: row.coupon_code,
    discountType: row.coupon_discount_type,
    grossAmountVnd: asBigInt(row.coupon_gross_amount_vnd, 'coupon_gross_amount_vnd'),
    discountAmountVnd: asBigInt(row.coupon_discount_amount_vnd, 'coupon_discount_amount_vnd'),
    finalAmountVnd: asBigInt(row.coupon_final_amount_vnd, 'coupon_final_amount_vnd'),
  };
}

function toAdminBookingListRow(row: AdminBookingListDbRow): AdminBookingListRow {
  return {
    bookingId: row.booking_id,
    bookingCode: row.booking_code,
    propertyId: row.property_id,
    status: row.status,
    checkIn: asDate(row.check_in, 'check_in'),
    checkOut: asDate(row.check_out, 'check_out'),
    finalAmountVnd: asBigInt(row.final_amount_vnd, 'final_amount_vnd'),
    currency: row.currency,
    createdAt: asDate(row.created_at, 'created_at'),
    roomTypeId: row.room_type_id,
    roomTypeCode: row.room_type_code,
    roomTypeName: row.room_type_name,
    roomId: row.room_id,
    roomNumber: row.room_number,
    fullName: row.full_name,
    paymentStatus: paymentStatusSummary(row.payment_status),
    reviewPresence: reviewPresence(row.review_status),
  };
}

function toAdminBookingDetailRow(row: AdminBookingDetailDbRow): AdminBookingDetailRow {
  const base = toAdminBookingListRow(row);
  return {
    ...base,
    propertyCode: row.property_code,
    propertyName: row.property_name,
    propertyTimezone: row.property_timezone,
    adults: row.adults,
    children: row.children,
    grossAmountVnd: asBigInt(row.gross_amount_vnd, 'gross_amount_vnd'),
    discountAmountVnd: asBigInt(row.discount_amount_vnd, 'discount_amount_vnd'),
    pricingRuleVersion: row.pricing_rule_version,
    priceSnapshot: row.price_snapshot,
    holdExpiresAt: asOptionalDate(row.hold_expires_at, 'hold_expires_at'),
    cancelledAt: asOptionalDate(row.cancelled_at, 'cancelled_at'),
    checkedInAt: asOptionalDate(row.checked_in_at, 'checked_in_at'),
    checkedOutAt: asOptionalDate(row.checked_out_at, 'checked_out_at'),
    noShowAt: asOptionalDate(row.no_show_at, 'no_show_at'),
    cancellationReason: row.cancellation_reason,
    normalizedEmail: row.normalized_email,
    normalizedPhoneE164: row.normalized_phone_e164,
    maxOccupancy: row.max_occupancy,
    coupon: readDetailCoupon(row),
    paymentAmountVnd:
      row.payment_amount_vnd === null
        ? null
        : asBigInt(row.payment_amount_vnd, 'payment_amount_vnd'),
    paymentConfirmationSource: row.payment_confirmation_source,
    paymentSucceededAt: asOptionalDate(row.payment_succeeded_at, 'payment_succeeded_at'),
    reviewId: row.review_id,
    reviewCategory: row.review_category,
    reviewOpenedAt: asOptionalDate(row.review_opened_at, 'review_opened_at'),
    reviewOpenedReason: row.review_opened_reason,
    reviewResolvedAt: asOptionalDate(row.review_resolved_at, 'review_resolved_at'),
    reviewResolvedNote: row.review_resolved_note,
  };
}

function toAdminOperationalReviewSummaryRow(
  row: AdminOperationalReviewDbRow,
): AdminOperationalReviewSummaryRow {
  return {
    reviewId: row.review_id,
    bookingId: row.booking_id,
    bookingCode: row.booking_code,
    bookingStatus: row.booking_status,
    category: row.category,
    status: row.status,
    openedAt: asDate(row.opened_at, 'opened_at'),
    openedReason: row.opened_reason,
    resolvedAt: asOptionalDate(row.resolved_at, 'resolved_at'),
    resolvedNote: row.resolved_note,
    finalAmountVnd: asBigInt(row.final_amount_vnd, 'final_amount_vnd'),
    currency: row.currency,
    paymentStatus: paymentStatusSummary(row.payment_status),
    paymentAmountVnd:
      row.payment_amount_vnd === null
        ? null
        : asBigInt(row.payment_amount_vnd, 'payment_amount_vnd'),
    paymentSucceededAt: asOptionalDate(row.payment_succeeded_at, 'payment_succeeded_at'),
    paymentConfirmationSource: row.payment_confirmation_source,
    roomId: row.room_id,
    roomNumber: row.room_number,
    roomTypeCode: row.room_type_code,
    roomTypeName: row.room_type_name,
  };
}

function toAdminOperationalReviewDetailRow(
  row: AdminOperationalReviewDbRow,
): AdminOperationalReviewDetailRow {
  return {
    ...toAdminOperationalReviewSummaryRow(row),
    propertyId: row.property_id ?? '',
    checkIn: asDate(row.check_in, 'check_in'),
    checkOut: asDate(row.check_out, 'check_out'),
  };
}

interface ListFilters {
  whereSql: string;
  params: unknown[];
}

function buildListFilters(propertyId: string, query: AdminBookingListQuery): ListFilters {
  const conditions: string[] = ['b.property_id = $1'];
  const params: unknown[] = [propertyId];
  let index = 2;

  if (query.q !== undefined) {
    conditions.push(`b.booking_code LIKE $${index} || '%'`);
    params.push(query.q);
    index += 1;
  }
  if (query.status !== undefined) {
    conditions.push(`b.status = $${index}`);
    params.push(query.status);
    index += 1;
  }
  if (query.paymentStatus !== undefined) {
    if (query.paymentStatus === 'NONE') {
      conditions.push('pay.status IS NULL');
    } else {
      conditions.push(`pay.status = $${index}`);
      params.push(query.paymentStatus);
      index += 1;
    }
  }
  if (query.roomTypeId !== undefined) {
    conditions.push(`b.room_type_id = $${index}`);
    params.push(query.roomTypeId);
    index += 1;
  }
  if (query.checkInFrom !== undefined) {
    conditions.push(`b.check_in >= $${index}`);
    params.push(new Date(query.checkInFrom));
    index += 1;
  }
  if (query.checkInTo !== undefined) {
    conditions.push(`b.check_in <= $${index}`);
    params.push(new Date(query.checkInTo));
    index += 1;
  }
  if (query.reviewPresence === 'open') {
    conditions.push("rv.status = 'OPEN'");
  } else if (query.reviewPresence === 'resolved') {
    conditions.push(
      `EXISTS (SELECT 1 FROM operational_reviews rv2 WHERE rv2.booking_id = b.id AND rv2.status = 'RESOLVED')`,
    );
  } else if (query.reviewPresence === 'none') {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM operational_reviews rv3 WHERE rv3.booking_id = b.id)`,
    );
  }

  return { whereSql: conditions.join(' AND '), params };
}

export class AdminBookingRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async listBookings(
    propertyId: string,
    query: AdminBookingListQuery,
  ): Promise<{ items: AdminBookingListRow[]; totalItems: number }> {
    const filters = buildListFilters(propertyId, query);
    const limit = query.pageSize;
    const offset = (query.page - 1) * query.pageSize;

    const listSql = `
      SELECT b.id              AS booking_id,
             b.booking_code    AS booking_code,
             b.property_id     AS property_id,
             b.status          AS status,
             b.check_in        AS check_in,
             b.check_out       AS check_out,
             b.final_amount_vnd AS final_amount_vnd,
             b.currency        AS currency,
             b.created_at      AS created_at,
             rt.id             AS room_type_id,
             rt.code           AS room_type_code,
             rt.name           AS room_type_name,
             r.id              AS room_id,
             r.room_number     AS room_number,
             bc.full_name      AS full_name,
             pay.status        AS payment_status,
             rv.status         AS review_status
        FROM bookings b
        JOIN room_types rt
             ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        LEFT JOIN rooms r
             ON r.property_id = b.property_id AND r.id = b.room_id
        JOIN booking_contacts bc ON bc.booking_id = b.id
        LEFT JOIN payments pay ON pay.booking_id = b.id
        LEFT JOIN LATERAL (
          SELECT *
            FROM operational_reviews
           WHERE booking_id = b.id AND status = 'OPEN'
           ORDER BY opened_at DESC
           LIMIT 1
        ) rv ON TRUE
       WHERE ${filters.whereSql}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const totalSql = `
      SELECT COUNT(*)::text AS count
        FROM bookings b
        JOIN room_types rt
             ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        LEFT JOIN rooms r
             ON r.property_id = b.property_id AND r.id = b.room_id
        JOIN booking_contacts bc ON bc.booking_id = b.id
        LEFT JOIN payments pay ON pay.booking_id = b.id
        LEFT JOIN LATERAL (
          SELECT *
            FROM operational_reviews
           WHERE booking_id = b.id AND status = 'OPEN'
           ORDER BY opened_at DESC
           LIMIT 1
        ) rv ON TRUE
       WHERE ${filters.whereSql}`;

    const [items, total] = await Promise.all([
      this.pool.query<AdminBookingListDbRow>(listSql, filters.params),
      this.pool.query<{ count: string }>(totalSql, filters.params),
    ]);
    return {
      items: items.rows.map(toAdminBookingListRow),
      totalItems: Number(total.rows[0]?.count ?? '0'),
    };
  }

  public async findDetailByBookingCode(bookingCode: string): Promise<AdminBookingDetailRow | null> {
    const result = await this.pool.query<AdminBookingDetailDbRow>(
      `SELECT b.id                       AS booking_id,
              b.booking_code             AS booking_code,
              b.property_id              AS property_id,
              b.status                   AS status,
              b.check_in                 AS check_in,
              b.check_out                AS check_out,
              b.adults                   AS adults,
              b.children                 AS children,
              b.currency                 AS currency,
              b.gross_amount_vnd         AS gross_amount_vnd,
              b.discount_amount_vnd      AS discount_amount_vnd,
              b.final_amount_vnd         AS final_amount_vnd,
              b.pricing_rule_version     AS pricing_rule_version,
              b.price_snapshot           AS price_snapshot,
              b.hold_expires_at          AS hold_expires_at,
              b.cancelled_at             AS cancelled_at,
              b.checked_in_at            AS checked_in_at,
              b.checked_out_at           AS checked_out_at,
              b.no_show_at               AS no_show_at,
              b.cancellation_reason      AS cancellation_reason,
              b.created_at               AS created_at,
              rt.id                      AS room_type_id,
              rt.code                    AS room_type_code,
              rt.name                    AS room_type_name,
              rt.max_occupancy           AS max_occupancy,
              r.id                       AS room_id,
              r.room_number              AS room_number,
              p.code                     AS property_code,
              p.name                     AS property_name,
              p.timezone                 AS property_timezone,
              bc.full_name               AS full_name,
              bc.normalized_email        AS normalized_email,
              bc.normalized_phone_e164   AS normalized_phone_e164,
              bca.coupon_code_snapshot   AS coupon_code,
              bca.discount_type          AS coupon_discount_type,
              bca.gross_amount_vnd       AS coupon_gross_amount_vnd,
              bca.discount_amount_vnd    AS coupon_discount_amount_vnd,
              bca.final_amount_vnd       AS coupon_final_amount_vnd,
              pay.amount_vnd             AS payment_amount_vnd,
              pay.confirmation_source    AS payment_confirmation_source,
              pay.succeeded_at           AS payment_succeeded_at,
              pay.status                 AS payment_status,
              rv.id                      AS review_id,
              rv.category                AS review_category,
              rv.opened_at               AS review_opened_at,
              rv.opened_reason           AS review_opened_reason,
              rv.resolved_at             AS review_resolved_at,
              rv.resolved_note           AS review_resolved_note,
              NULL::text                 AS review_status
         FROM bookings b
         JOIN properties p ON p.id = b.property_id
         JOIN room_types rt
              ON rt.property_id = b.property_id AND rt.id = b.room_type_id
         LEFT JOIN rooms r
              ON r.property_id = b.property_id AND r.id = b.room_id
         JOIN booking_contacts bc ON bc.booking_id = b.id
         LEFT JOIN booking_coupon_applications bca ON bca.booking_id = b.id
         LEFT JOIN payments pay ON pay.booking_id = b.id
         LEFT JOIN LATERAL (
           SELECT *
             FROM operational_reviews
            WHERE booking_id = b.id
            ORDER BY opened_at DESC
            LIMIT 1
         ) rv ON TRUE
        WHERE b.booking_code = $1
        LIMIT 1`,
      [bookingCode],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toAdminBookingDetailRow(row);
  }

  public async listTimelineByBookingId(bookingId: string): Promise<AdminBookingTimelineRow[]> {
    const result = await this.pool.query<{
      id: string;
      event_type: string;
      actor_type: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
      actor_id: string | null;
      occurred_at: Date | string;
      payload: unknown;
    }>(
      `SELECT id, event_type, actor_type, actor_id, occurred_at, payload
         FROM audit_events
        WHERE aggregate_type = 'BOOKING' AND aggregate_id = $1
        ORDER BY occurred_at ASC, id ASC`,
      [bookingId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actorType: row.actor_type,
      actorId: row.actor_id,
      occurredAt: asDate(row.occurred_at, 'occurred_at'),
      payload: sanitizePayload(row.payload),
    }));
  }

  public async listOperationalReviews(
    propertyId: string,
    query: AdminOperationalReviewListQuery,
  ): Promise<{ items: AdminOperationalReviewSummaryRow[]; totalItems: number }> {
    const status = query.status ?? 'OPEN';
    const limit = query.pageSize;
    const offset = (query.page - 1) * query.pageSize;
    const conditions: string[] = ['rv.property_id = $1', 'rv.status = $2'];
    const params: unknown[] = [propertyId, status];
    let index = 3;
    if (query.bookingCode !== undefined) {
      conditions.push(`b.booking_code LIKE $${index} || '%'`);
      params.push(query.bookingCode);
      index += 1;
    }
    const whereSql = conditions.join(' AND ');

    const itemsSql = `
      SELECT rv.id              AS review_id,
             rv.booking_id      AS booking_id,
             rv.category        AS category,
             rv.status          AS status,
             rv.opened_at       AS opened_at,
             rv.opened_reason   AS opened_reason,
             rv.resolved_at     AS resolved_at,
             rv.resolved_note   AS resolved_note,
             b.booking_code     AS booking_code,
             b.status           AS booking_status,
             b.check_in         AS check_in,
             b.check_out        AS check_out,
             b.final_amount_vnd AS final_amount_vnd,
             b.currency         AS currency,
             rt.code            AS room_type_code,
             rt.name            AS room_type_name,
             r.id               AS room_id,
             r.room_number      AS room_number,
             pay.amount_vnd     AS payment_amount_vnd,
             pay.status         AS payment_status,
             pay.succeeded_at   AS payment_succeeded_at,
             pay.confirmation_source AS payment_confirmation_source
        FROM operational_reviews rv
        JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id
        JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        LEFT JOIN rooms r ON r.property_id = b.property_id AND r.id = b.room_id
        LEFT JOIN payments pay ON pay.booking_id = b.id
       WHERE ${whereSql}
       ORDER BY rv.opened_at DESC, rv.id DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const totalSql = `
      SELECT COUNT(*)::text AS count
        FROM operational_reviews rv
        JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id
       WHERE ${whereSql}`;

    const [items, total] = await Promise.all([
      this.pool.query<AdminOperationalReviewDbRow>(itemsSql, params),
      this.pool.query<{ count: string }>(totalSql, params),
    ]);
    return {
      items: items.rows.map(toAdminOperationalReviewSummaryRow),
      totalItems: Number(total.rows[0]?.count ?? '0'),
    };
  }

  public async findOperationalReviewById(
    reviewId: string,
  ): Promise<AdminOperationalReviewDetailRow | null> {
    const result = await this.pool.query<AdminOperationalReviewDbRow>(
      `SELECT rv.id              AS review_id,
              rv.booking_id      AS booking_id,
              rv.category        AS category,
              rv.status          AS status,
              rv.opened_at       AS opened_at,
              rv.opened_reason   AS opened_reason,
              rv.resolved_at     AS resolved_at,
              rv.resolved_note   AS resolved_note,
              rv.property_id     AS property_id,
              b.booking_code     AS booking_code,
              b.status           AS booking_status,
              b.check_in         AS check_in,
              b.check_out        AS check_out,
              b.final_amount_vnd AS final_amount_vnd,
              b.currency         AS currency,
              rt.code            AS room_type_code,
              rt.name            AS room_type_name,
              r.id               AS room_id,
              r.room_number      AS room_number,
              pay.amount_vnd     AS payment_amount_vnd,
              pay.status         AS payment_status,
              pay.succeeded_at   AS payment_succeeded_at,
              pay.confirmation_source AS payment_confirmation_source
         FROM operational_reviews rv
         JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id
         JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
         LEFT JOIN rooms r ON r.property_id = b.property_id AND r.id = b.room_id
         LEFT JOIN payments pay ON pay.booking_id = b.id
        WHERE rv.id = $1
        LIMIT 1`,
      [reviewId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toAdminOperationalReviewDetailRow(row);
  }
}
```

## `apps/api/src/booking/repositories/booking-detail.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\repositories\booking-detail.repository.ts`
- Lines: 182

### Top-level declarations / exports

- `export class BookingDetailRepository`
- `export function toBookingDetailRecord(row: DetailRow): BookingDetailRecord`
- `export interface BookingDetailCouponSnapshot`
- `export interface BookingDetailRecord`
- `function asBigIntAmount(value: string | number | bigint): number`
- `function asDate(value: Date | string, field: string): Date`
- `function asOptionalBigIntAmount(value: string | number | bigint | null): number | null`
- `function readCoupon(row: DetailRow): BookingDetailCouponSnapshot | null`
- `interface DetailRow`

### Function / method signatures

- `export function toBookingDetailRecord(row: DetailRow)`
- `function asBigIntAmount(value: string | number | bigint)`
- `function asDate(value: Date | string, field: string)`
- `function asOptionalBigIntAmount(value: string | number | bigint | null)`
- `function readCoupon(row: DetailRow)`
- `if (Number.isNaN(parsed.getTime()))`
- `if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(0))`
- `if (gross === null || discount === null || final === null)`
- `if (row === undefined)`
- `if (row.coupon_code === null || row.coupon_discount_type === null)`
- `if (typeof value === 'number')`
- `if (value === null)`
- `if (value instanceof Date)`
- `public constructor(private readonly client: DatabaseClient)`

### Database tables / schema references

- `FROM bookings b`
- `JOIN booking_contacts bc ON bc.booking_id = b.id`
- `JOIN properties p   ON p.id = b.property_id`
- `JOIN room_types rt  ON rt.property_id = b.property_id AND rt.id = b.room_type_id`
- `LEFT JOIN booking_coupon_applications bca`
- `import { sql, type DatabaseClient } from '@room/database';`
- `sql\`SELECT b.id AS booking_id,`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const parsed = new Date(value);`

### Money / arithmetic operations

- `const big = typeof value === 'string' ? BigInt(value) : value;`
- `const discount = asOptionalBigIntAmount(row.coupon_discount_amount_vnd);`
- `const final = asOptionalBigIntAmount(row.coupon_final_amount_vnd);`
- `const gross = asOptionalBigIntAmount(row.coupon_gross_amount_vnd);`
- `discountAmountVnd: discount,`
- `finalAmountVnd: asBigIntAmount(row.final_amount_vnd),`
- `finalAmountVnd: final,`
- `function asBigIntAmount(value: string | number | bigint): number {`
- `function asOptionalBigIntAmount(value: string | number | bigint | null): number | null {`
- `grossAmountVnd: gross,`
- `if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(0)) {`
- `import { sql, type DatabaseClient } from '@room/database';`
- `readonly discountAmountVnd: number;`
- `readonly finalAmountVnd: number;`
- `readonly grossAmountVnd: number;`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { sql, type DatabaseClient } from '@room/database';

export interface BookingDetailRecord {
  readonly bookingId: string;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly bookingCode: string;
  readonly status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly currency: 'VND';
  readonly finalAmountVnd: number;
  readonly holdExpiresAt: Date | null;
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly propertyTimezone: string;
  readonly roomTypeCode: string;
  readonly roomTypeName: string;
  readonly maxOccupancy: number;
  readonly fullName: string;
  readonly normalizedEmail: string;
  readonly normalizedPhoneE164: string;
  readonly coupon: BookingDetailCouponSnapshot | null;
}

export interface BookingDetailCouponSnapshot {
  readonly code: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly grossAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly finalAmountVnd: number;
}

interface DetailRow {
  booking_id: string;
  property_id: string;
  room_type_id: string;
  booking_code: string;
  status: BookingDetailRecord['status'];
  check_in: Date | string;
  check_out: Date | string;
  adults: number;
  children: number;
  currency: 'VND';
  final_amount_vnd: string | number | bigint;
  hold_expires_at: Date | string | null;
  property_code: string;
  property_name: string;
  property_timezone: string;
  room_type_code: string;
  room_type_name: string;
  max_occupancy: number;
  full_name: string;
  normalized_email: string;
  normalized_phone_e164: string;
  coupon_code: string | null;
  coupon_discount_type: 'FIXED' | 'PERCENTAGE' | null;
  coupon_gross_amount_vnd: string | number | bigint | null;
  coupon_discount_amount_vnd: string | number | bigint | null;
  coupon_final_amount_vnd: string | number | bigint | null;
}

function asDate(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

function asBigIntAmount(value: string | number | bigint): number {
  if (typeof value === 'number') return value;
  const big = typeof value === 'string' ? BigInt(value) : value;
  if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(0)) {
    throw new Error('final_amount_vnd is out of safe range');
  }
  return Number(big);
}

function asOptionalBigIntAmount(value: string | number | bigint | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return value;
  const big = typeof value === 'string' ? BigInt(value) : value;
  if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(0)) {
    throw new Error('coupon amount is out of safe range');
  }
  return Number(big);
}

function readCoupon(row: DetailRow): BookingDetailCouponSnapshot | null {
  if (row.coupon_code === null || row.coupon_discount_type === null) return null;
  const gross = asOptionalBigIntAmount(row.coupon_gross_amount_vnd);
  const discount = asOptionalBigIntAmount(row.coupon_discount_amount_vnd);
  const final = asOptionalBigIntAmount(row.coupon_final_amount_vnd);
  if (gross === null || discount === null || final === null) return null;
  return {
    code: row.coupon_code,
    discountType: row.coupon_discount_type,
    grossAmountVnd: gross,
    discountAmountVnd: discount,
    finalAmountVnd: final,
  };
}

export function toBookingDetailRecord(row: DetailRow): BookingDetailRecord {
  return {
    bookingId: row.booking_id,
    propertyId: row.property_id,
    roomTypeId: row.room_type_id,
    bookingCode: row.booking_code,
    status: row.status,
    checkIn: asDate(row.check_in, 'check_in'),
    checkOut: asDate(row.check_out, 'check_out'),
    adults: row.adults,
    children: row.children,
    currency: row.currency,
    finalAmountVnd: asBigIntAmount(row.final_amount_vnd),
    holdExpiresAt:
      row.hold_expires_at === null ? null : asDate(row.hold_expires_at, 'hold_expires_at'),
    propertyCode: row.property_code,
    propertyName: row.property_name,
    propertyTimezone: row.property_timezone,
    roomTypeCode: row.room_type_code,
    roomTypeName: row.room_type_name,
    maxOccupancy: row.max_occupancy,
    fullName: row.full_name,
    normalizedEmail: row.normalized_email,
    normalizedPhoneE164: row.normalized_phone_e164,
    coupon: readCoupon(row),
  };
}

export class BookingDetailRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByBookingCodeForSession(
    bookingCode: string,
  ): Promise<BookingDetailRecord | null> {
    const result = await this.client.execute<DetailRow & Record<string, unknown>>(
      sql`SELECT b.id            AS booking_id,
                b.property_id   AS property_id,
                b.room_type_id  AS room_type_id,
                b.booking_code  AS booking_code,
                b.status        AS status,
                b.check_in      AS check_in,
                b.check_out     AS check_out,
                b.adults        AS adults,
                b.children      AS children,
                b.currency      AS currency,
                b.final_amount_vnd AS final_amount_vnd,
                b.hold_expires_at  AS hold_expires_at,
                p.code          AS property_code,
                p.name          AS property_name,
                p.timezone      AS property_timezone,
                rt.code         AS room_type_code,
                rt.name         AS room_type_name,
                rt.max_occupancy AS max_occupancy,
                bc.full_name    AS full_name,
                bc.normalized_email AS normalized_email,
                bc.normalized_phone_e164 AS normalized_phone_e164,
                bca.coupon_code_snapshot AS coupon_code,
                bca.discount_type   AS coupon_discount_type,
                bca.gross_amount_vnd AS coupon_gross_amount_vnd,
                bca.discount_amount_vnd AS coupon_discount_amount_vnd,
                bca.final_amount_vnd AS coupon_final_amount_vnd
           FROM bookings b
           JOIN properties p   ON p.id = b.property_id
           JOIN room_types rt  ON rt.property_id = b.property_id AND rt.id = b.room_type_id
           JOIN booking_contacts bc ON bc.booking_id = b.id
           LEFT JOIN booking_coupon_applications bca
                  ON bca.booking_id = b.id
                 AND bca.application_status IN ('ASSOCIATED', 'RESERVED', 'REDEEMED')
          WHERE b.booking_code = ${bookingCode}`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toBookingDetailRecord(row);
  }
}
```

## `apps/api/src/booking/repositories/guest-access.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\repositories\guest-access.repository.ts`
- Lines: 595

### Top-level declarations / exports

- `export class GuestAccessRepository`
- `export interface ActiveChallengeLookup`
- `export interface BookingContactLookup`
- `export interface ConsumeOtpParams`
- `export interface GuestAccessRateLimitConfig`
- `export interface GuestAccessSecrets`
- `export interface RequestOtpParams`
- `export interface RevokeSessionParams`
- `export type ConsumeOtpOutcome`
- `export type RequestOtpOutcome`
- `function parseSqlTimestamp(value: Date | string, field: string): Date`
- `function timingSafeEqualStrings(a: string, b: string): boolean`
- `interface ActiveChallengeRow`
- `interface BookingRow`
- `interface ChallengeLookupRow`

### Function / method signatures

- `VALUES
       (gen_random_uuid()`
- `for (let i = 0; i < a.length; i += 1)`
- `function parseSqlTimestamp(value: Date | string, field: string)`
- `function timingSafeEqualStrings(a: string, b: string)`
- `if (!contactDigestMatches)`
- `if (!otpMatches)`
- `if (Number.isNaN(parsed.getTime()))`
- `if (a.length !== b.length)`
- `if (bookingRow !== undefined)`
- `if (bookingRow === undefined || contactEmailDigest === null)`
- `if (bookingRow.status !== 'HOLD' && bookingRow.status !== 'CONFIRMED')`
- `if (challengeRow === undefined)`
- `if (challengeRow.attempts >= challengeRow.max_attempts)`
- `if (challengeRow.booking_status !== 'HOLD' && challengeRow.booking_status !== 'CONFIRMED')`
- `if (expiresAt.getTime() <= databaseNow.getTime())`
- `if (ipCount >= this.config.ipLimit)`
- `if (requestCount >= this.config.requestLimit)`
- `if (result.rows.length === 0)`
- `if (row === undefined)`
- `if (sessionExpiresAt.getTime() <= databaseNow.getTime())`
- `if (value === null || value === undefined)`
- `if (value instanceof Date)`
- `public async consumeOtp(params: ConsumeOtpParams): Promise<ConsumeOtpOutcome>`
- `public async requestOtp(params: RequestOtpParams): Promise<RequestOtpOutcome>`
- `public async revokeSession(params: RevokeSessionParams): Promise<Date>`
- `timingSafeEqualStrings(params.otp, expectedOtp)`

### Database tables / schema references

- `'SELECT CURRENT_TIMESTAMP AS database_now',`
- `* we can use SELECT FOR UPDATE without fighting Drizzle's transaction`
- `FROM bookings b`
- `FROM guest_otp_challenges`
- `FROM guest_otp_challenges goc`
- `JOIN bookings b ON b.id = goc.booking_id`
- `LEFT JOIN booking_contacts bc ON bc.booking_id = b.id`
- `\`INSERT INTO audit_events`
- `\`INSERT INTO guest_otp_challenges`
- `\`INSERT INTO guest_sessions`
- `\`INSERT INTO outbox_events`
- `\`SELECT COUNT(*)::text AS count`
- `\`SELECT b.id AS booking_id,`
- `\`SELECT email_digest FROM booking_contacts WHERE booking_id = $1\`,`
- `\`SELECT goc.id AS challenge_id,`
- `\`UPDATE guest_otp_challenges`
- `\`UPDATE guest_sessions`
- `import { Buffer } from 'node:buffer';`
- `import { randomBytes, randomUUID } from 'node:crypto';`
- `import { sql, type DatabaseClient, type DatabasePool } from '@room/database';`
- `parts: [Buffer.from(normalizeChallengeRef(challengeRef), 'utf8')],`
- `parts: [Buffer.from(normalizedRef, 'utf8')],`
- `sql\`SELECT b.id AS booking_id,`
- `sql\`SELECT id AS challenge_id,`
- `} from '@room/booking';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `: new Date(databaseNowRaw);`
- `const expiresAt = new Date(databaseNow.getTime() + this.config.otpTtlMs);`
- `const parsed = new Date(value);`
- `const sessionExpiresAt = new Date(databaseNow.getTime() + this.config.sessionTtlMs);`
- `return value instanceof Date ? value : new Date(value);`

### Money / arithmetic operations

- `*`
- `*                 consume + insert session + audit + outbox.`
- `*                 replace active challenge, insert challenge + outbox.`
- `*  - consumeChallenge: verify challenge state, increment attempts or`
- `*  - requestOtp:  find booking, look up contact digest, rate-limit,`
- `*  - revokeSessionByDigest: idempotent logout.`
- `* All write paths go through raw SQL on a checked-out pool client so`
- `* Encapsulates the three write transactions Phase 5 needs:`
- `* Repository for the public guest-access flow.`
- `* type for bytea columns. Read paths can use the drizzle client.`
- `* we can use SELECT FOR UPDATE without fighting Drizzle's transaction`
- `*/`
- `/**`
- `// Defensive guard: the constraint is the source of truth but we`
- `// Rate-limit counters use database time, not the request time.`
- `// Replace any active challenge for this booking. Mark it`
- `// The expires_at CHECK constraint requires expires_at > created_at.`
- `// \`replaced_at\` so the OTP skip rules and the consume path`
- `// confusing 500.`
- `// re-check here so a clock skew regression does not surface as a`
- `// recognize that it can never verify.`
- `AND created_at > $2::timestamptz - ($3::bigint * INTERVAL '1 millisecond')\`,`
- `AND created_at > $3::timestamptz - ($4::bigint * INTERVAL '1 millisecond')\`,`
- `\`SELECT COUNT(*)::text AS count`
- `cooldownSeconds: Math.ceil(this.config.resendCooldownMs / 1000),`
- `import { sql, type DatabaseClient, type DatabasePool } from '@room/database';`
- `retryAfterSeconds: Math.ceil(this.config.ipWindowMs / 1000),`
- `retryAfterSeconds: Math.ceil(this.config.requestWindowMs / 1000),`
- `} from '@room/booking';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
/**
 * Repository for the public guest-access flow.
 *
 * Encapsulates the three write transactions Phase 5 needs:
 *  - requestOtp:  find booking, look up contact digest, rate-limit,
 *                 replace active challenge, insert challenge + outbox.
 *  - consumeChallenge: verify challenge state, increment attempts or
 *                 consume + insert session + audit + outbox.
 *  - revokeSessionByDigest: idempotent logout.
 *
 * All write paths go through raw SQL on a checked-out pool client so
 * we can use SELECT FOR UPDATE without fighting Drizzle's transaction
 * type for bytea columns. Read paths can use the drizzle client.
 */

import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';

import { sql, type DatabaseClient, type DatabasePool } from '@room/database';
import {
  computeDigest,
  DIGEST_DOMAIN_LABELS,
  deriveChallengeRef,
  deriveOtp,
  generateDecoyChallengeRef,
  normalizeBookingCode,
  normalizeChallengeRef,
  type NormalizedContact,
} from '@room/booking';

export interface GuestAccessRateLimitConfig {
  readonly requestWindowMs: number;
  readonly requestLimit: number;
  readonly ipWindowMs: number;
  readonly ipLimit: number;
  readonly resendCooldownMs: number;
  readonly otpTtlMs: number;
  readonly sessionTtlMs: number;
}

export interface GuestAccessSecrets {
  readonly otpSecret: Buffer;
  readonly challengeRefSecret: Buffer;
  readonly sessionSecret: Buffer;
  readonly ipDigestSecret: Buffer;
}

export interface RequestOtpParams {
  readonly bookingCode: string;
  readonly contact: NormalizedContact;
  readonly requestIpDigest: Buffer;
  readonly now: Date;
}

export type RequestOtpOutcome =
  | {
      readonly kind: 'CHALLENGE_ISSUED';
      readonly challengeRef: string;
      readonly challengeId: string;
      readonly expiresAt: Date;
      readonly cooldownSeconds: number;
      readonly serverTime: Date;
    }
  | { readonly kind: 'DECOY_ISSUED'; readonly challengeRef: string; readonly serverTime: Date }
  | {
      readonly kind: 'OTP_RATE_LIMITED';
      readonly retryAfterSeconds: number;
      readonly serverTime: Date;
    };

export interface ConsumeOtpParams {
  readonly challengeRef: string;
  readonly otp: string;
  readonly requestIpDigest: Buffer;
  readonly now: Date;
}

export type ConsumeOtpOutcome =
  | {
      readonly kind: 'CONSUMED';
      readonly bookingId: string;
      readonly bookingCode: string;
      readonly sessionId: string;
      readonly sessionToken: Buffer;
      readonly sessionExpiresAt: Date;
    }
  | { readonly kind: 'OTP_INVALID_OR_EXPIRED'; readonly serverTime: Date };

export interface RevokeSessionParams {
  readonly tokenDigest: Buffer;
  readonly now: Date;
}

export interface BookingContactLookup {
  readonly bookingId: string;
  readonly propertyId: string;
  readonly contactEmailDigest: Buffer | null;
}

export interface ActiveChallengeLookup {
  readonly challengeId: string;
  readonly createdAt: Date;
}

interface BookingRow {
  booking_id: string;
  property_id: string;
  status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  booking_code: string;
  contact_email_digest: Buffer | null;
}

interface ActiveChallengeRow {
  challenge_id: string;
  created_at: Date | string;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export class GuestAccessRepository {
  public constructor(
    private readonly pool: DatabasePool,
    private readonly database: DatabaseClient,
    private readonly secrets: GuestAccessSecrets,
    private readonly config: GuestAccessRateLimitConfig,
  ) {}

  public async lookupBookingForOtpRequest(
    normalizedBookingCode: string,
  ): Promise<BookingContactLookup | null> {
    const result = await this.database.execute<BookingRow & Record<string, unknown>>(
      sql`SELECT b.id              AS booking_id,
                 b.property_id     AS property_id,
                 b.status          AS status,
                 b.booking_code    AS booking_code,
                 bc.email_digest   AS contact_email_digest
            FROM bookings b
            LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
           WHERE b.booking_code = ${normalizedBookingCode}`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      bookingId: row.booking_id,
      propertyId: row.property_id,
      contactEmailDigest: row.contact_email_digest,
    };
  }

  public async findActiveChallenge(bookingId: string): Promise<ActiveChallengeLookup | null> {
    const result = await this.database.execute<ActiveChallengeRow & Record<string, unknown>>(
      sql`SELECT id            AS challenge_id,
                 created_at    AS created_at
            FROM guest_otp_challenges
           WHERE booking_id = ${bookingId}
             AND consumed_at IS NULL
             AND replaced_at IS NULL
           LIMIT 1`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      challengeId: row.challenge_id,
      createdAt: parseSqlTimestamp(row.created_at, 'created_at'),
    };
  }

  public async requestOtp(params: RequestOtpParams): Promise<RequestOtpOutcome> {
    const normalizedCode = normalizeBookingCode(params.bookingCode);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const nowResult = await client.query<{ database_now: Date }>(
        'SELECT CURRENT_TIMESTAMP AS database_now',
      );
      const databaseNowRaw = nowResult.rows[0]?.database_now;
      const databaseNow =
        databaseNowRaw === undefined
          ? params.now
          : databaseNowRaw instanceof Date
            ? databaseNowRaw
            : new Date(databaseNowRaw);

      const bookingResult = await client.query<BookingRow>(
        `SELECT b.id            AS booking_id,
                b.property_id   AS property_id,
                b.status        AS status,
                b.booking_code  AS booking_code
           FROM bookings b
          WHERE b.booking_code = $1
          FOR UPDATE`,
        [normalizedCode],
      );
      const bookingRow = bookingResult.rows[0];

      let contactEmailDigest: Buffer | null = null;
      if (bookingRow !== undefined) {
        const contactResult = await client.query<{ email_digest: Buffer | null }>(
          `SELECT email_digest FROM booking_contacts WHERE booking_id = $1`,
          [bookingRow.booking_id],
        );
        contactEmailDigest = contactResult.rows[0]?.email_digest ?? null;
      }

      if (bookingRow === undefined || contactEmailDigest === null) {
        await client.query('COMMIT');
        return {
          kind: 'DECOY_ISSUED',
          challengeRef: generateDecoyChallengeRef(),
          serverTime: databaseNow,
        };
      }

      const contactDigestMatches =
        contactEmailDigest.length === params.contact.emailDigest.length &&
        Buffer.compare(contactEmailDigest, params.contact.emailDigest) === 0;

      if (!contactDigestMatches) {
        await client.query('COMMIT');
        return {
          kind: 'DECOY_ISSUED',
          challengeRef: generateDecoyChallengeRef(),
          serverTime: databaseNow,
        };
      }

      if (bookingRow.status !== 'HOLD' && bookingRow.status !== 'CONFIRMED') {
        await client.query('COMMIT');
        return {
          kind: 'DECOY_ISSUED',
          challengeRef: generateDecoyChallengeRef(),
          serverTime: databaseNow,
        };
      }

      // Rate-limit counters use database time, not the request time.
      const requestCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM guest_otp_challenges
          WHERE booking_id = $1
            AND email_digest = $2
            AND created_at > $3::timestamptz - ($4::bigint * INTERVAL '1 millisecond')`,
        [bookingRow.booking_id, contactEmailDigest, databaseNow, this.config.requestWindowMs],
      );
      const requestCount = Number(requestCountResult.rows[0]?.count ?? '0');
      if (requestCount >= this.config.requestLimit) {
        await client.query('COMMIT');
        return {
          kind: 'OTP_RATE_LIMITED',
          retryAfterSeconds: Math.ceil(this.config.requestWindowMs / 1000),
          serverTime: databaseNow,
        };
      }

      const ipCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM guest_otp_challenges
          WHERE request_ip_digest = $1
            AND created_at > $2::timestamptz - ($3::bigint * INTERVAL '1 millisecond')`,
        [params.requestIpDigest, databaseNow, this.config.ipWindowMs],
      );
      const ipCount = Number(ipCountResult.rows[0]?.count ?? '0');
      if (ipCount >= this.config.ipLimit) {
        await client.query('COMMIT');
        return {
          kind: 'OTP_RATE_LIMITED',
          retryAfterSeconds: Math.ceil(this.config.ipWindowMs / 1000),
          serverTime: databaseNow,
        };
      }

      // Replace any active challenge for this booking. Mark it
      // `replaced_at` so the OTP skip rules and the consume path
      // recognize that it can never verify.
      await client.query(
        `UPDATE guest_otp_challenges
            SET replaced_at = $2::timestamptz
          WHERE booking_id = $1
            AND consumed_at IS NULL
            AND replaced_at IS NULL`,
        [bookingRow.booking_id, databaseNow],
      );

      const challengeId = randomUUID();
      const nonce = randomBytes(32);
      const expiresAt = new Date(databaseNow.getTime() + this.config.otpTtlMs);
      const challengeRef = deriveChallengeRef({
        secretKey: this.secrets.challengeRefSecret,
        challengeId,
      });
      const challengeRefDigest = computeDigest({
        secretKey: this.secrets.challengeRefSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.challengeRef,
        parts: [Buffer.from(normalizeChallengeRef(challengeRef), 'utf8')],
      });

      await client.query(
        `INSERT INTO guest_otp_challenges
           (id, booking_id, nonce, email_digest, request_ip_digest,
            challenge_ref_digest, attempts, max_attempts, expires_at,
            consumed_at, replaced_at, created_at)
         VALUES
           ($1, $2, $3, $4, $5,
            $6, 0, 5, $7,
            NULL, NULL, $8)`,
        [
          challengeId,
          bookingRow.booking_id,
          nonce,
          contactEmailDigest,
          params.requestIpDigest,
          challengeRefDigest,
          expiresAt,
          databaseNow,
        ],
      );

      // The expires_at CHECK constraint requires expires_at > created_at.
      // Defensive guard: the constraint is the source of truth but we
      // re-check here so a clock skew regression does not surface as a
      // confusing 500.
      if (expiresAt.getTime() <= databaseNow.getTime()) {
        throw new Error('OTP expires_at must be strictly after created_at');
      }

      await client.query(
        `INSERT INTO outbox_events
           (id, property_id, aggregate_type, aggregate_id, event_type,
            payload, status, attempt_count, available_at, published_at,
            lease_id, claimed_at, lease_expires_at, last_error_category)
         VALUES
           (gen_random_uuid(), $1, 'BOOKING', $2, 'booking.otp.requested',
            $3::jsonb, 'PENDING', 0, $4, NULL,
            NULL, NULL, NULL, NULL)`,
        [
          bookingRow.property_id,
          bookingRow.booking_id,
          JSON.stringify({
            eventVersion: 1,
            bookingId: bookingRow.booking_id,
            challengeId,
          }),
          databaseNow,
        ],
      );

      await client.query(
        `INSERT INTO audit_events
           (property_id, aggregate_type, aggregate_id, event_type, payload,
            actor_type, actor_id, occurred_at)
         VALUES
           ($1, 'BOOKING', $2, 'booking.otp.requested',
            $3::jsonb, 'GUEST', NULL, $4)`,
        [
          bookingRow.property_id,
          bookingRow.booking_id,
          JSON.stringify({
            eventVersion: 1,
            challengeId,
            emailDigestLength: contactEmailDigest.length,
          }),
          databaseNow,
        ],
      );

      await client.query('COMMIT');

      return {
        kind: 'CHALLENGE_ISSUED',
        challengeRef,
        challengeId,
        expiresAt,
        cooldownSeconds: Math.ceil(this.config.resendCooldownMs / 1000),
        serverTime: databaseNow,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async consumeOtp(params: ConsumeOtpParams): Promise<ConsumeOtpOutcome> {
    const normalizedRef = normalizeChallengeRef(params.challengeRef);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const nowResult = await client.query<{ database_now: Date }>(
        'SELECT CURRENT_TIMESTAMP AS database_now',
      );
      const databaseNowRaw = nowResult.rows[0]?.database_now;
      const databaseNow =
        databaseNowRaw === undefined
          ? params.now
          : databaseNowRaw instanceof Date
            ? databaseNowRaw
            : new Date(databaseNowRaw);

      const lookupResult = await client.query<ChallengeLookupRow>(
        `SELECT goc.id           AS challenge_id,
                goc.booking_id   AS booking_id,
                goc.nonce        AS nonce,
                goc.email_digest AS email_digest,
                goc.attempts     AS attempts,
                goc.max_attempts AS max_attempts,
                goc.expires_at   AS expires_at,
                goc.consumed_at  AS consumed_at,
                goc.replaced_at  AS replaced_at,
                goc.challenge_ref_digest AS challenge_ref_digest,
                b.booking_code   AS booking_code,
                b.property_id    AS property_id,
                b.status         AS booking_status
           FROM guest_otp_challenges goc
           JOIN bookings b ON b.id = goc.booking_id
          WHERE goc.challenge_ref_digest = $1
          FOR UPDATE`,
        [
          computeDigest({
            secretKey: this.secrets.challengeRefSecret,
            domainLabel: DIGEST_DOMAIN_LABELS.challengeRef,
            parts: [Buffer.from(normalizedRef, 'utf8')],
          }),
        ],
      );
      const challengeRow = lookupResult.rows[0];

      const failureOutcome: ConsumeOtpOutcome = {
        kind: 'OTP_INVALID_OR_EXPIRED',
        serverTime: databaseNow,
      };

      if (challengeRow === undefined) {
        await client.query('COMMIT');
        return failureOutcome;
      }
      if (challengeRow.consumed_at !== null || challengeRow.replaced_at !== null) {
        await client.query('COMMIT');
        return failureOutcome;
      }
      if (challengeRow.booking_status !== 'HOLD' && challengeRow.booking_status !== 'CONFIRMED') {
        await client.query('COMMIT');
        return failureOutcome;
      }
      if (challengeRow.attempts >= challengeRow.max_attempts) {
        await client.query('COMMIT');
        return failureOutcome;
      }
      const expiresAt = parseSqlTimestamp(challengeRow.expires_at, 'expires_at');
      if (expiresAt.getTime() <= databaseNow.getTime()) {
        await client.query('COMMIT');
        return failureOutcome;
      }

      const expectedOtp = deriveOtp({
        secretKey: this.secrets.otpSecret,
        labelByteSequence: challengeRow.nonce,
      });
      const otpMatches =
        typeof params.otp === 'string' &&
        params.otp.length === expectedOtp.length &&
        timingSafeEqualStrings(params.otp, expectedOtp);

      if (!otpMatches) {
        await client.query(
          `UPDATE guest_otp_challenges
              SET attempts = attempts + 1
            WHERE id = $1`,
          [challengeRow.challenge_id],
        );
        await client.query('COMMIT');
        return failureOutcome;
      }

      const sessionToken = randomBytes(32);
      const sessionTokenDigest = computeDigest({
        secretKey: this.secrets.sessionSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
        parts: [sessionToken],
      });
      const sessionExpiresAt = new Date(databaseNow.getTime() + this.config.sessionTtlMs);
      const sessionId = randomUUID();

      await client.query(
        `UPDATE guest_otp_challenges
            SET consumed_at = $2::timestamptz
          WHERE id = $1`,
        [challengeRow.challenge_id, databaseNow],
      );

      if (sessionExpiresAt.getTime() <= databaseNow.getTime()) {
        throw new Error('session expires_at must be strictly after created_at');
      }

      await client.query(
        `INSERT INTO guest_sessions
           (id, booking_id, token_digest, created_ip_digest,
            expires_at, revoked_at, created_at)
         VALUES
           ($1, $2, $3, $4,
            $5, NULL, $6)`,
        [
          sessionId,
          challengeRow.booking_id,
          sessionTokenDigest,
          params.requestIpDigest,
          sessionExpiresAt,
          databaseNow,
        ],
      );

      await client.query(
        `INSERT INTO audit_events
           (property_id, aggregate_type, aggregate_id, event_type, payload,
            actor_type, actor_id, occurred_at)
         VALUES
           ($1, 'GUEST_SESSION', $2, 'guest.session.issued',
            '{"eventVersion":1}'::jsonb, 'GUEST', NULL, $3)`,
        [challengeRow.property_id, sessionId, databaseNow],
      );

      await client.query('COMMIT');

      return {
        kind: 'CONSUMED',
        bookingId: challengeRow.booking_id,
        bookingCode: challengeRow.booking_code,
        sessionId,
        sessionToken,
        sessionExpiresAt,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async revokeSession(params: RevokeSessionParams): Promise<Date> {
    const result = await this.pool.query<{ revoked_at: Date | string | null }>(
      `UPDATE guest_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
        WHERE token_digest = $1
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        RETURNING revoked_at`,
      [params.tokenDigest],
    );
    if (result.rows.length === 0) {
      return params.now;
    }
    const value = result.rows[0]?.revoked_at;
    if (value === null || value === undefined) return params.now;
    return value instanceof Date ? value : new Date(value);
  }
}

interface ChallengeLookupRow {
  challenge_id: string;
  booking_id: string;
  nonce: Buffer;
  email_digest: Buffer;
  attempts: number;
  max_attempts: number;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  replaced_at: Date | string | null;
  challenge_ref_digest: Buffer;
  booking_code: string;
  property_id: string;
  booking_status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
```

## `apps/api/src/booking/repositories/guest-session.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\repositories\guest-session.repository.ts`
- Lines: 63

### Top-level declarations / exports

- `export class GuestSessionRepository`
- `export function digestSessionToken(sessionSecret: Buffer, token: Buffer): Buffer`
- `export interface GuestSessionRecord`
- `function parseSqlTimestamp(value: Date | string, field: string): Date`
- `interface SessionLookupRow`

### Function / method signatures

- `export function digestSessionToken(sessionSecret: Buffer, token: Buffer)`
- `function parseSqlTimestamp(value: Date | string, field: string)`
- `if (Number.isNaN(parsed.getTime()))`
- `if (row === undefined)`
- `if (value instanceof Date)`
- `public constructor(private readonly pool: DatabasePool)`

### Database tables / schema references

- `FROM guest_sessions`
- `\`SELECT id AS session_id,`
- `import { Buffer } from 'node:buffer';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `import { type DatabasePool } from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const parsed = new Date(value);`

### Money / arithmetic operations

- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `import { type DatabasePool } from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';

import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import { type DatabasePool } from '@room/database';

export interface GuestSessionRecord {
  readonly sessionId: string;
  readonly bookingId: string;
  readonly expiresAt: Date;
}

interface SessionLookupRow {
  readonly session_id: string;
  readonly booking_id: string;
  readonly expires_at: Date | string;
  readonly revoked_at: Date | string | null;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export function digestSessionToken(sessionSecret: Buffer, token: Buffer): Buffer {
  return computeDigest({
    secretKey: sessionSecret,
    domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
    parts: [token],
  });
}

export class GuestSessionRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async findActiveSession(
    tokenDigest: Buffer,
    now: Date,
  ): Promise<GuestSessionRecord | null> {
    const result = await this.pool.query<SessionLookupRow>(
      `SELECT id          AS session_id,
              booking_id  AS booking_id,
              expires_at  AS expires_at,
              revoked_at  AS revoked_at
         FROM guest_sessions
        WHERE token_digest = $1
          AND revoked_at IS NULL
          AND expires_at > $2
        LIMIT 1`,
      [tokenDigest, now],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      sessionId: row.session_id,
      bookingId: row.booking_id,
      expiresAt: parseSqlTimestamp(row.expires_at, 'expires_at'),
    };
  }
}
```

## `apps/api/src/booking/secrets.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\secrets.ts`
- Lines: 43

### Top-level declarations / exports

- `export function loadGuestSecrets(source: GuestSecretSource): GuestSecrets`
- `export interface GuestSecretSource`
- `export interface GuestSecrets`

### Function / method signatures

- `export function loadGuestSecrets(source: GuestSecretSource)`
- `if (buffer.length < minLength)`

### Database tables / schema references

- `* Buffer-typed secrets loaded from the API environment for guest access.`
- `const challengeRefSecret = Buffer.from(source.GUEST_CHALLENGE_REF_SECRET, 'utf8');`
- `const ipDigestSecret = Buffer.from(source.BOOKING_IP_DIGEST_SECRET, 'utf8');`
- `const otpSecret = Buffer.from(source.GUEST_OTP_SECRET, 'utf8');`
- `const sessionSecret = Buffer.from(source.GUEST_SESSION_SECRET, 'utf8');`
- `import { Buffer } from 'node:buffer';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `*`
- `* Buffer-typed secrets loaded from the API environment for guest access.`
- `* No raw secret value crosses the module boundary.`
- `* The bytes are derived once at boot so HMAC inputs are deterministic.`
- `*/`
- `/**`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
/**
 * Buffer-typed secrets loaded from the API environment for guest access.
 *
 * The bytes are derived once at boot so HMAC inputs are deterministic.
 * No raw secret value crosses the module boundary.
 */

import { Buffer } from 'node:buffer';

export interface GuestSecrets {
  readonly otpSecret: Buffer;
  readonly challengeRefSecret: Buffer;
  readonly sessionSecret: Buffer;
  readonly ipDigestSecret: Buffer;
}

export interface GuestSecretSource {
  readonly GUEST_OTP_SECRET: string;
  readonly GUEST_CHALLENGE_REF_SECRET: string;
  readonly GUEST_SESSION_SECRET: string;
  readonly BOOKING_IP_DIGEST_SECRET: string;
}

export function loadGuestSecrets(source: GuestSecretSource): GuestSecrets {
  const otpSecret = Buffer.from(source.GUEST_OTP_SECRET, 'utf8');
  const challengeRefSecret = Buffer.from(source.GUEST_CHALLENGE_REF_SECRET, 'utf8');
  const sessionSecret = Buffer.from(source.GUEST_SESSION_SECRET, 'utf8');
  const ipDigestSecret = Buffer.from(source.BOOKING_IP_DIGEST_SECRET, 'utf8');

  const minLength = 32;
  for (const [name, buffer] of [
    ['GUEST_OTP_SECRET', otpSecret],
    ['GUEST_CHALLENGE_REF_SECRET', challengeRefSecret],
    ['GUEST_SESSION_SECRET', sessionSecret],
    ['BOOKING_IP_DIGEST_SECRET', ipDigestSecret],
  ] as const) {
    if (buffer.length < minLength) {
      throw new Error(`${name} must be at least ${minLength} bytes`);
    }
  }

  return { otpSecret, challengeRefSecret, sessionSecret, ipDigestSecret };
}
```

## `apps/api/src/booking/services/admin-booking-lifecycle.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\admin-booking-lifecycle.service.ts`
- Lines: 771

### Top-level declarations / exports

- `export class AdminBookingLifecycleService`
- `function asDate(value: Date | string, field: string): Date`
- `function bigIntToNumber(value: bigint): number`
- `function deriveAvailableActions(status: AdminBookingStatus): readonly AdminBookingAction[]`
- `function maskPhone(value: string): string`
- `function toAdminBookingDetail(`
- `function toAdminBookingSummary(`
- `function toAdminOperationalReviewDetail(`
- `function toSummaryItem(row: AdminOperationalReviewSummaryRow)`
- `interface BookingLifecycleRow`

### Function / method signatures

- `VALUES ($1, $2, $3, 'PAID_CANCELLATION', 'OPEN', $4, $5)`
- `VALUES ($1, 'BOOKING', $2, $3, $4::jsonb, 'PENDING')`
- `VALUES ($1, 'BOOKING', $2, $3, 'ADMIN', $4, $5::jsonb, now())`
- `VALUES ($1, 'BOOKING', $2, 'OPERATIONAL_REVIEW_OPENED', 'ADMIN', $3, $4::jsonb, $5)`
- `async function isPaymentSucceeded(client: DatabasePoolClient, bookingId: string)`
- `function asDate(value: Date | string, field: string)`
- `function bigIntToNumber(value: bigint)`
- `function deriveAvailableActions(status: AdminBookingStatus)`
- `function maskPhone(value: string)`
- `function toSummaryItem(row: AdminOperationalReviewSummaryRow)`
- `if (Number.isNaN(parsed.getTime()))`
- `if (current === undefined)`
- `if (current.status !== 'OPEN')`
- `if (detail === null)`
- `if (existing.rows[0] !== undefined)`
- `if (from === 'HOLD')`
- `if (id === undefined)`
- `if (now.getTime() < checkIn.getTime())`
- `if (paid && from === 'CONFIRMED')`
- `if (paymentId === null)`
- `if (reviewRow === undefined)`
- `if (row === undefined)`
- `if (row.status !== 'CHECKED_IN')`
- `if (row.status !== 'CONFIRMED')`
- `if (row.status !== 'HOLD' && row.status !== 'CONFIRMED')`
- `if (row.status === 'CANCELLED')`
- `if (value > BigInt(Number.MAX_SAFE_INTEGER))`
- `if (value instanceof Date)`
- `if (value.length <= 4)`
- `switch (status)`

### Database tables / schema references

- `FROM bookings`
- `\`INSERT INTO audit_events (`
- `\`INSERT INTO audit_events (property_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload, occurred_at)`
- `\`INSERT INTO operational_reviews (`
- `\`INSERT INTO outbox_events (`
- `\`SELECT COUNT(*)::text AS count FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED'\`,`
- `\`SELECT booking_id, property_id FROM operational_reviews WHERE id = $1\`,`
- `\`SELECT id FROM operational_reviews`
- `\`SELECT id FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED' LIMIT 1\`,`
- `\`SELECT id, property_id, room_id, booking_code, status,`
- `\`SELECT status FROM operational_reviews WHERE id = $1 FOR UPDATE\`,`
- `\`UPDATE booking_coupon_applications`
- `\`UPDATE bookings`
- `\`UPDATE operational_reviews`
- `\`UPDATE room_inventory_blocks`
- `const from = row.status;`
- `if (from === 'HOLD') {`
- `if (paid && from === 'CONFIRMED') {`
- `import type { ActorContext } from '../../auth/actor-context.js';`
- `import { BookingNotFoundError } from './booking-detail.service.js';`
- `import { maskEmailForDisplay } from '@room/booking';`
- `} from '../admin-booking.errors.js';`
- `} from '../repositories/admin-booking.repository.js';`
- `} from '@room/contracts';`
- `} from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `checkIn: row.checkIn.toISOString(),`
- `checkOut: row.checkOut.toISOString(),`
- `const parsed = new Date(value);`
- `createdAt: row.createdAt.toISOString(),`
- `occurredAt: entry.occurredAt.toISOString(),`
- `openedAt: row.openedAt.toISOString(),`
- `openedAt: row.reviewOpenedAt?.toISOString() ?? new Date(0).toISOString(),`
- `resolvedAt: row.resolvedAt?.toISOString() ?? null,`
- `resolvedAt: row.reviewResolvedAt?.toISOString() ?? null,`
- `serverTime: now.toISOString(),`
- `succeededAt: row.paymentSucceededAt?.toISOString() ?? null,`

### Money / arithmetic operations

- `: bigIntToNumber(row.paymentAmountVnd),`
- `? bigIntToNumber(row.finalAmountVnd)`
- `\`SELECT COUNT(*)::text AS count FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED'\`,`
- `amountVnd:`
- `amountVnd: bigIntToNumber(row.finalAmountVnd),`
- `const lateBySeconds = Math.max(0, Math.round((now.getTime() - checkIn.getTime()) / 1000));`
- `discountAmountVnd: bigIntToNumber(row.coupon.discountAmountVnd),`
- `discountAmountVnd: bigIntToNumber(row.discountAmountVnd),`
- `finalAmountVnd: bigIntToNumber(row.coupon.finalAmountVnd),`
- `finalAmountVnd: bigIntToNumber(row.finalAmountVnd),`
- `grossAmountVnd: bigIntToNumber(row.coupon.grossAmountVnd),`
- `grossAmountVnd: bigIntToNumber(row.grossAmountVnd),`
- `if (value > BigInt(Number.MAX_SAFE_INTEGER)) {`
- `import type { ActorContext } from '../../auth/actor-context.js';`
- `import { BookingNotFoundError } from './booking-detail.service.js';`
- `import { maskEmailForDisplay } from '@room/booking';`
- `row.paymentAmountVnd === null`
- `throw new Error('BigInt amount is out of safe range');`
- `} from '../admin-booking.errors.js';`
- `} from '../repositories/admin-booking.repository.js';`
- `} from '@room/contracts';`
- `} from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { type DatabasePool, type DatabasePoolClient } from '@room/database';

import {
  adminBookingCancelRequestSchema,
  adminBookingDetailSchema,
  adminBookingListResponseSchema,
  adminBookingListQuerySchema,
  adminBookingNoShowRequestSchema,
  adminBookingOperationalReviewSchema,
  adminBookingPaymentSummarySchema,
  adminBookingPricingSchema,
  adminBookingSummarySchema,
  adminOperationalReviewDetailSchema,
  adminOperationalReviewListQuerySchema,
  adminOperationalReviewListResponseSchema,
  adminOperationalReviewResolveRequestSchema,
  type AdminBookingAction,
  type AdminBookingDetail,
  type AdminBookingListResponse,
  type AdminBookingSummary,
  type AdminOperationalReviewDetail,
  type AdminOperationalReviewListResponse,
} from '@room/contracts';

import { maskEmailForDisplay } from '@room/booking';

import type { ActorContext } from '../../auth/actor-context.js';
import {
  BookingTransitionError,
  NoShowBeforeCheckInError,
  OperationalReviewAlreadyResolvedError,
  OperationalReviewNotFoundError,
} from '../admin-booking.errors.js';
import { BookingNotFoundError } from './booking-detail.service.js';
import {
  AdminBookingRepository,
  type AdminBookingDetailRow,
  type AdminBookingStatus,
  type AdminBookingTimelineRow,
  type AdminOperationalReviewDetailRow,
  type AdminOperationalReviewSummaryRow,
} from '../repositories/admin-booking.repository.js';

function bigIntToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('BigInt amount is out of safe range');
  }
  return Number(value);
}

function maskPhone(value: string): string {
  if (value.length <= 4) return value;
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

function toAdminBookingSummary(
  row: Awaited<ReturnType<AdminBookingRepository['listBookings']>>['items'][number],
): AdminBookingSummary {
  return adminBookingSummarySchema.parse({
    bookingCode: row.bookingCode,
    status: row.status,
    checkIn: row.checkIn.toISOString(),
    checkOut: row.checkOut.toISOString(),
    roomType: {
      id: row.roomTypeId,
      code: row.roomTypeCode,
      name: row.roomTypeName,
    },
    room:
      row.roomId === null || row.roomNumber === null
        ? null
        : { id: row.roomId, roomNumber: row.roomNumber },
    guestName: row.fullName,
    finalAmountVnd: bigIntToNumber(row.finalAmountVnd),
    currency: 'VND',
    paymentStatus: row.paymentStatus,
    reviewPresence: row.reviewPresence,
    createdAt: row.createdAt.toISOString(),
  });
}

function deriveAvailableActions(status: AdminBookingStatus): readonly AdminBookingAction[] {
  switch (status) {
    case 'HOLD':
      return ['cancel'];
    case 'CONFIRMED':
      return ['cancel', 'check-in', 'no-show'];
    case 'CHECKED_IN':
      return ['check-out'];
    default:
      return [];
  }
}

function toAdminBookingDetail(
  row: AdminBookingDetailRow,
  timeline: readonly AdminBookingTimelineRow[],
  now: Date,
): AdminBookingDetail {
  return adminBookingDetailSchema.parse({
    bookingCode: row.bookingCode,
    status: row.status,
    property: {
      code: row.propertyCode,
      name: row.propertyName,
      timezone: row.propertyTimezone,
    },
    contact: {
      fullName: row.fullName,
      emailMasked: maskEmailForDisplay(row.normalizedEmail),
      phoneMasked: maskPhone(row.normalizedPhoneE164),
    },
    occupancy: { adults: row.adults, children: row.children },
    roomType: {
      id: row.roomTypeId,
      code: row.roomTypeCode,
      name: row.roomTypeName,
      maxOccupancy: row.maxOccupancy,
    },
    room:
      row.roomId === null || row.roomNumber === null
        ? null
        : { id: row.roomId, roomNumber: row.roomNumber },
    interval: {
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
    },
    pricing: adminBookingPricingSchema.parse({
      grossAmountVnd: bigIntToNumber(row.grossAmountVnd),
      discountAmountVnd: bigIntToNumber(row.discountAmountVnd),
      finalAmountVnd: bigIntToNumber(row.finalAmountVnd),
      currency: 'VND',
      coupon:
        row.coupon === null
          ? null
          : {
              code: row.coupon.code,
              discountType: row.coupon.discountType,
              grossAmountVnd: bigIntToNumber(row.coupon.grossAmountVnd),
              discountAmountVnd: bigIntToNumber(row.coupon.discountAmountVnd),
              finalAmountVnd: bigIntToNumber(row.coupon.finalAmountVnd),
            },
    }),
    payment: adminBookingPaymentSummarySchema.parse({
      status: row.paymentStatus,
      amountVnd:
        row.paymentAmountVnd === null
          ? bigIntToNumber(row.finalAmountVnd)
          : bigIntToNumber(row.paymentAmountVnd),
      confirmationSource: row.paymentConfirmationSource,
      succeededAt: row.paymentSucceededAt?.toISOString() ?? null,
    }),
    operationalReview:
      row.reviewId === null
        ? null
        : adminBookingOperationalReviewSchema.parse({
            reviewId: row.reviewId,
            category: row.reviewCategory ?? 'PAID_CANCELLATION',
            status:
              row.reviewResolvedAt === null && row.reviewResolvedNote === null
                ? 'OPEN'
                : 'RESOLVED',
            openedAt: row.reviewOpenedAt?.toISOString() ?? new Date(0).toISOString(),
            openedReason: row.reviewOpenedReason ?? '',
            resolvedAt: row.reviewResolvedAt?.toISOString() ?? null,
            resolvedNote: row.reviewResolvedNote,
          }),
    timeline: timeline.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      actorType: entry.actorType,
      actorId: entry.actorId,
      occurredAt: entry.occurredAt.toISOString(),
      payload: entry.payload,
    })),
    availableActions: deriveAvailableActions(row.status),
    serverTime: now.toISOString(),
  });
}

function toAdminOperationalReviewDetail(
  row: AdminOperationalReviewDetailRow,
  timeline: readonly AdminBookingTimelineRow[],
  now: Date,
): AdminOperationalReviewDetail {
  const paymentSummary = adminBookingPaymentSummarySchema.parse({
    status: row.paymentStatus,
    amountVnd:
      row.paymentAmountVnd === null
        ? bigIntToNumber(row.finalAmountVnd)
        : bigIntToNumber(row.paymentAmountVnd),
    confirmationSource: row.paymentConfirmationSource,
    succeededAt: row.paymentSucceededAt?.toISOString() ?? null,
  });
  return adminOperationalReviewDetailSchema.parse({
    reviewId: row.reviewId,
    bookingCode: row.bookingCode,
    bookingStatus: row.bookingStatus,
    category: row.category,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    openedReason: row.openedReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    paymentStatus: row.paymentStatus,
    amountVnd: bigIntToNumber(row.finalAmountVnd),
    booking: {
      bookingCode: row.bookingCode,
      status: row.bookingStatus,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      roomType: { code: row.roomTypeCode, name: row.roomTypeName },
      room:
        row.roomId === null || row.roomNumber === null
          ? null
          : { id: row.roomId, roomNumber: row.roomNumber },
      finalAmountVnd: bigIntToNumber(row.finalAmountVnd),
    },
    payment: paymentSummary,
    timeline: timeline.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      actorType: entry.actorType,
      actorId: entry.actorId,
      occurredAt: entry.occurredAt.toISOString(),
      payload: entry.payload,
    })),
    serverTime: now.toISOString(),
  });
}

interface BookingLifecycleRow {
  readonly id: string;
  readonly property_id: string;
  readonly room_id: string;
  readonly booking_code: string;
  readonly status: AdminBookingStatus;
  readonly check_in: Date | string;
  readonly check_out: Date | string;
  readonly cancelled_at: Date | string | null;
  readonly checked_in_at: Date | string | null;
  readonly checked_out_at: Date | string | null;
  readonly no_show_at: Date | string | null;
  readonly cancellation_reason: string | null;
  readonly hold_expires_at: Date | string | null;
}

function asDate(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export class AdminBookingLifecycleService {
  public constructor(
    private readonly pool: DatabasePool,
    private readonly repository: AdminBookingRepository,
  ) {}

  public async listBookings(propertyId: string, query: unknown): Promise<AdminBookingListResponse> {
    const parsed = adminBookingListQuerySchema.parse(query);
    const result = await this.repository.listBookings(propertyId, parsed);
    return adminBookingListResponseSchema.parse({
      items: result.items.map(toAdminBookingSummary),
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalItems: result.totalItems,
    });
  }

  public async getDetail(bookingCode: string, now: Date): Promise<AdminBookingDetail> {
    const detail = await this.repository.findDetailByBookingCode(bookingCode);
    if (detail === null) {
      throw new BookingNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminBookingDetail(detail, timeline, now);
  }

  public async cancel(
    actor: ActorContext,
    bookingCode: string,
    input: unknown,
    now: Date,
  ): Promise<AdminBookingDetail> {
    const command = adminBookingCancelRequestSchema.parse(input);
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status === 'CANCELLED') {
        throw new BookingTransitionError('Booking is already cancelled.');
      }
      if (row.status !== 'HOLD' && row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(`Cannot cancel a booking in status ${row.status}.`);
      }
      const from = row.status;
      const paid = await isPaymentSucceeded(client, row.id);

      await client.query(
        `UPDATE bookings
            SET status = 'CANCELLED',
                cancelled_at = $2,
                cancellation_reason = $3,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now, command.reason],
      );

      await releaseInventoryBlock(client, row.id, now);

      if (from === 'HOLD') {
        await releaseCouponReservation(client, row.id, now);
      }

      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_CANCELLED',
        payload: {
          bookingCode: row.booking_code,
          from,
          reason: command.reason,
          paid,
        },
      });

      let reviewId: string | null = null;
      if (paid && from === 'CONFIRMED') {
        const openedReview = await openPaidCancellationReview(
          client,
          row.property_id,
          row.id,
          now,
          command.reason,
          actor,
        );
        reviewId = openedReview.id;
      }
      void reviewId;

      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.cancelled',
        payload: {
          eventVersion: 1,
          bookingId: row.id,
          from,
          reason: command.reason,
        },
      });
    });
  }

  public async checkIn(
    actor: ActorContext,
    bookingCode: string,
    now: Date,
  ): Promise<AdminBookingDetail> {
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(`Cannot check in a booking in status ${row.status}.`);
      }
      await client.query(
        `UPDATE bookings
            SET status = 'CHECKED_IN',
                checked_in_at = $2,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now],
      );
      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_CHECKED_IN',
        payload: { bookingCode: row.booking_code },
      });
      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.checked_in',
        payload: { eventVersion: 1, bookingId: row.id },
      });
    });
  }

  public async checkOut(
    actor: ActorContext,
    bookingCode: string,
    now: Date,
  ): Promise<AdminBookingDetail> {
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status !== 'CHECKED_IN') {
        throw new BookingTransitionError(`Cannot check out a booking in status ${row.status}.`);
      }
      await client.query(
        `UPDATE bookings
            SET status = 'CHECKED_OUT',
                checked_out_at = $2,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now],
      );
      await releaseInventoryBlock(client, row.id, now);
      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_CHECKED_OUT',
        payload: { bookingCode: row.booking_code },
      });
      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.checked_out',
        payload: { eventVersion: 1, bookingId: row.id },
      });
    });
  }

  public async markNoShow(
    actor: ActorContext,
    bookingCode: string,
    input: unknown,
    now: Date,
  ): Promise<AdminBookingDetail> {
    const command = adminBookingNoShowRequestSchema.parse(input);
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(
          `Cannot mark no-show for a booking in status ${row.status}.`,
        );
      }
      const checkIn = asDate(row.check_in, 'check_in');
      if (now.getTime() < checkIn.getTime()) {
        throw new NoShowBeforeCheckInError();
      }
      const lateBySeconds = Math.max(0, Math.round((now.getTime() - checkIn.getTime()) / 1000));
      await client.query(
        `UPDATE bookings
            SET status = 'NO_SHOW',
                no_show_at = $2,
                cancellation_reason = $3,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now, command.reason],
      );
      await releaseInventoryBlock(client, row.id, now);
      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_NO_SHOW',
        payload: {
          bookingCode: row.booking_code,
          reason: command.reason,
          lateBySeconds,
        },
      });
      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.no_show',
        payload: { eventVersion: 1, bookingId: row.id, lateBySeconds },
      });
    });
  }

  public async listOperationalReviews(
    propertyId: string,
    query: unknown,
  ): Promise<AdminOperationalReviewListResponse> {
    const parsed = adminOperationalReviewListQuerySchema.parse(query);
    const result = await this.repository.listOperationalReviews(propertyId, parsed);
    return adminOperationalReviewListResponseSchema.parse({
      items: result.items.map(toSummaryItem),
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalItems: result.totalItems,
    });
  }

  public async getOperationalReviewDetail(
    reviewId: string,
    now: Date,
  ): Promise<AdminOperationalReviewDetail> {
    const detail = await this.repository.findOperationalReviewById(reviewId);
    if (detail === null) {
      throw new OperationalReviewNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminOperationalReviewDetail(detail, timeline, now);
  }

  public async resolveOperationalReview(
    actor: ActorContext,
    reviewId: string,
    input: unknown,
    now: Date,
  ): Promise<AdminOperationalReviewDetail> {
    const command = adminOperationalReviewResolveRequestSchema.parse(input);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const lockResult = await client.query<{ status: 'OPEN' | 'RESOLVED' }>(
        `SELECT status FROM operational_reviews WHERE id = $1 FOR UPDATE`,
        [reviewId],
      );
      const current = lockResult.rows[0];
      if (current === undefined) {
        await client.query('ROLLBACK');
        throw new OperationalReviewNotFoundError();
      }
      if (current.status !== 'OPEN') {
        await client.query('ROLLBACK');
        throw new OperationalReviewAlreadyResolvedError();
      }
      const reviewRowResult = await client.query<{ booking_id: string; property_id: string }>(
        `SELECT booking_id, property_id FROM operational_reviews WHERE id = $1`,
        [reviewId],
      );
      const reviewRow = reviewRowResult.rows[0];
      if (reviewRow === undefined) {
        await client.query('ROLLBACK');
        throw new OperationalReviewNotFoundError();
      }
      await client.query(
        `UPDATE operational_reviews
            SET status = 'RESOLVED',
                resolved_at = $2,
                resolver_id = $3,
                resolved_note = $4,
                updated_at = $2
          WHERE id = $1`,
        [reviewId, now, actor.userId, command.note],
      );
      await appendAudit(client, {
        propertyId: reviewRow.property_id,
        bookingId: reviewRow.booking_id,
        bookingCode: '',
        actor,
        eventType: 'OPERATIONAL_REVIEW_RESOLVED',
        payload: { reviewId, note: command.note },
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    const detail = await this.repository.findOperationalReviewById(reviewId);
    if (detail === null) {
      throw new OperationalReviewNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminOperationalReviewDetail(detail, timeline, now);
  }

  private async runTransition(
    actor: ActorContext,
    bookingCode: string,
    now: Date,
    operation: (client: DatabasePoolClient, row: BookingLifecycleRow) => Promise<void>,
  ): Promise<AdminBookingDetail> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const lockResult = await client.query<BookingLifecycleRow>(
        `SELECT id, property_id, room_id, booking_code, status,
                check_in, check_out, cancelled_at, checked_in_at,
                checked_out_at, no_show_at, cancellation_reason, hold_expires_at
           FROM bookings
          WHERE booking_code = $1
          FOR UPDATE`,
        [bookingCode],
      );
      const row = lockResult.rows[0];
      if (row === undefined) {
        await client.query('ROLLBACK');
        throw new BookingNotFoundError();
      }
      await operation(client, row);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return this.getDetail(bookingCode, now);
  }
}

async function isPaymentSucceeded(client: DatabasePoolClient, bookingId: string): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED'`,
    [bookingId],
  );
  return Number(result.rows[0]?.count ?? '0') > 0;
}

async function releaseInventoryBlock(
  client: DatabasePoolClient,
  bookingId: string,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE room_inventory_blocks
        SET status = 'RELEASED',
            released_at = $2
      WHERE booking_id = $1
        AND status = 'ACTIVE'`,
    [bookingId, now],
  );
}

async function releaseCouponReservation(
  client: DatabasePoolClient,
  bookingId: string,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE booking_coupon_applications
        SET application_status = 'RELEASED',
            quota_reserved = false,
            released_at = $2
      WHERE booking_id = $1
        AND application_status IN ('RESERVED', 'ASSOCIATED')`,
    [bookingId, now],
  );
}

async function openPaidCancellationReview(
  client: DatabasePoolClient,
  propertyId: string,
  bookingId: string,
  now: Date,
  reason: string,
  actor: ActorContext,
): Promise<{ id: string }> {
  const paymentResult = await client.query<{ id: string }>(
    `SELECT id FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED' LIMIT 1`,
    [bookingId],
  );
  const paymentId = paymentResult.rows[0]?.id ?? null;
  if (paymentId === null) {
    throw new Error('Paid cancellation attempted without a SUCCEEDED payment row');
  }
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM operational_reviews
      WHERE booking_id = $1 AND category = 'PAID_CANCELLATION' AND status = 'OPEN'
      LIMIT 1`,
    [bookingId],
  );
  if (existing.rows[0] !== undefined) {
    return { id: existing.rows[0].id };
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO operational_reviews (
        property_id, booking_id, payment_id, category, status,
        opened_at, opened_reason
     )
     VALUES ($1, $2, $3, 'PAID_CANCELLATION', 'OPEN', $4, $5)
     RETURNING id`,
    [propertyId, bookingId, paymentId, now, reason],
  );
  const id = inserted.rows[0]?.id;
  if (id === undefined) {
    throw new Error('Operational review insert returned no rows');
  }
  await client.query(
    `INSERT INTO audit_events (property_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload, occurred_at)
     VALUES ($1, 'BOOKING', $2, 'OPERATIONAL_REVIEW_OPENED', 'ADMIN', $3, $4::jsonb, $5)`,
    [
      propertyId,
      bookingId,
      actor.userId,
      JSON.stringify({ reviewId: id, category: 'PAID_CANCELLATION', status: 'OPEN' }),
      now,
    ],
  );
  return { id };
}

async function appendAudit(
  client: DatabasePoolClient,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly bookingCode: string;
    readonly actor: ActorContext;
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
        property_id, aggregate_type, aggregate_id, event_type,
        actor_type, actor_id, payload, occurred_at
     )
     VALUES ($1, 'BOOKING', $2, $3, 'ADMIN', $4, $5::jsonb, now())`,
    [
      input.propertyId,
      input.bookingId,
      input.eventType,
      input.actor.userId,
      JSON.stringify(input.payload),
    ],
  );
}

async function enqueueBookingOutbox(
  client: DatabasePoolClient,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (
        property_id, aggregate_type, aggregate_id, event_type,
        payload, status
     )
     VALUES ($1, 'BOOKING', $2, $3, $4::jsonb, 'PENDING')`,
    [input.propertyId, input.bookingId, input.eventType, JSON.stringify(input.payload)],
  );
}

function toSummaryItem(row: AdminOperationalReviewSummaryRow) {
  return {
    reviewId: row.reviewId,
    bookingCode: row.bookingCode,
    bookingStatus: row.bookingStatus,
    category: row.category,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    openedReason: row.openedReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    paymentStatus: row.paymentStatus,
    amountVnd: bigIntToNumber(row.finalAmountVnd),
  };
}
```

## `apps/api/src/booking/services/booking-detail.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\booking-detail.service.ts`
- Lines: 86

### Top-level declarations / exports

- `export class BookingDetailService`
- `export class BookingNotFoundError extends Error`
- `function maskPhone(phoneE164: string): string`
- `function toResponse(record: BookingDetailRecord, serverTime: Date): BookingDetailResponse`

### Function / method signatures

- `function maskPhone(phoneE164: string)`
- `function toResponse(record: BookingDetailRecord, serverTime: Date)`
- `if (phoneE164.length <= 4)`
- `if (record === null)`
- `public constructor()`
- `super('Booking not found')`

### Database tables / schema references

- `import { Buffer } from 'node:buffer';`
- `import { GuestSessionService } from './guest-session.service.js';`
- `import { maskEmailForDisplay } from '@room/booking';`
- `} from '../repositories/booking-detail.repository.js';`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `checkIn: record.checkIn.toISOString(),`
- `checkOut: record.checkOut.toISOString(),`
- `holdExpiresAt: record.holdExpiresAt === null ? null : record.holdExpiresAt.toISOString(),`
- `serverTime: serverTime.toISOString(),`

### Money / arithmetic operations

- `amountVnd: record.finalAmountVnd,`
- `discountAmountVnd: record.coupon.discountAmountVnd,`
- `finalAmountVnd: record.coupon.finalAmountVnd,`
- `grossAmountVnd: record.coupon.grossAmountVnd,`
- `import { GuestSessionService } from './guest-session.service.js';`
- `import { maskEmailForDisplay } from '@room/booking';`
- `} from '../repositories/booking-detail.repository.js';`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import { maskEmailForDisplay } from '@room/booking';
import {
  bookingDetailResponseSchema,
  bookingHoldCouponSummarySchema,
  type BookingDetailResponse,
} from '@room/contracts';

import {
  type BookingDetailRecord,
  type BookingDetailRepository,
} from '../repositories/booking-detail.repository.js';
import { GuestSessionService } from './guest-session.service.js';

export class BookingNotFoundError extends Error {
  public readonly code = 'BOOKING_NOT_FOUND';
  public constructor() {
    super('Booking not found');
    this.name = 'BookingNotFoundError';
  }
}

function maskPhone(phoneE164: string): string {
  if (phoneE164.length <= 4) return phoneE164;
  return `${phoneE164.slice(0, 3)}••••${phoneE164.slice(-2)}`;
}

function toResponse(record: BookingDetailRecord, serverTime: Date): BookingDetailResponse {
  const coupon = record.coupon
    ? bookingHoldCouponSummarySchema.parse({
        code: record.coupon.code,
        discountType: record.coupon.discountType,
        grossAmountVnd: record.coupon.grossAmountVnd,
        discountAmountVnd: record.coupon.discountAmountVnd,
        finalAmountVnd: record.coupon.finalAmountVnd,
      })
    : undefined;
  return bookingDetailResponseSchema.parse({
    bookingCode: record.bookingCode,
    status: record.status,
    property: {
      code: record.propertyCode,
      name: record.propertyName,
      timezone: record.propertyTimezone,
    },
    roomType: {
      code: record.roomTypeCode,
      name: record.roomTypeName,
      maxOccupancy: record.maxOccupancy,
    },
    checkIn: record.checkIn.toISOString(),
    checkOut: record.checkOut.toISOString(),
    adults: record.adults,
    children: record.children,
    amountVnd: record.finalAmountVnd,
    currency: record.currency,
    holdExpiresAt: record.holdExpiresAt === null ? null : record.holdExpiresAt.toISOString(),
    contact: {
      fullName: record.fullName,
      emailMasked: maskEmailForDisplay(record.normalizedEmail),
      phoneMasked: maskPhone(record.normalizedPhoneE164),
    },
    ...(coupon !== undefined ? { coupon } : {}),
    serverTime: serverTime.toISOString(),
  });
}

export class BookingDetailService {
  public constructor(
    private readonly repository: BookingDetailRepository,
    private readonly session: GuestSessionService,
  ) {}

  public async getByBookingCode(
    bookingCode: string,
    sessionToken: Buffer | null,
    now: Date,
  ): Promise<BookingDetailResponse> {
    const record = await this.repository.findByBookingCodeForSession(bookingCode);
    if (record === null) {
      throw new BookingNotFoundError();
    }
    await this.session.requireForBooking(sessionToken, record.bookingId, now);
    return toResponse(record, now);
  }
}
```

## `apps/api/src/booking/services/booking-hold-status.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\booking-hold-status.service.ts`
- Lines: 81

### Top-level declarations / exports

- `export class BookingHoldStatusService`
- `function parseSqlTimestamp(value: Date | string, field: string): Date`
- `interface StatusLookupRow`

### Function / method signatures

- `AND (bc.email_digest IS NULL OR bc.email_digest = ${emailDigest})`
- `function parseSqlTimestamp(value: Date | string, field: string)`
- `if (Number.isNaN(parsed.getTime()))`
- `if (expiresAt.getTime() <= now.getTime())`
- `if (row === undefined)`
- `if (row.status === 'HOLD' && row.hold_expires_at !== null)`
- `if (value instanceof Date)`
- `public async status(input: unknown, now: Date): Promise<BookingHoldStatusResponse>`

### Database tables / schema references

- `FROM bookings b`
- `LEFT JOIN booking_contacts bc ON bc.booking_id = b.id`
- `import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';`
- `import { Buffer } from 'node:buffer';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `import { sql, type DatabaseClient } from '@room/database';`
- `parts: [Buffer.from(request.email, 'utf8')],`
- `sql\`SELECT b.id AS booking_id,`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const parsed = new Date(value);`
- `holdExpiresAt: expiresAt.toISOString(),`
- `serverTime: now.toISOString(),`

### Money / arithmetic operations

- `import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `import { sql, type DatabaseClient } from '@room/database';`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import {
  bookingHoldStatusRequestSchema,
  bookingHoldStatusResponseSchema,
  type BookingHoldStatusRequest,
  type BookingHoldStatusResponse,
} from '@room/contracts';
import { sql, type DatabaseClient } from '@room/database';

import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';

interface StatusLookupRow {
  booking_id: string;
  status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  hold_expires_at: Date | string | null;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export class BookingHoldStatusService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly secrets: GuestAccessSecrets,
  ) {}

  public async status(input: unknown, now: Date): Promise<BookingHoldStatusResponse> {
    const request: BookingHoldStatusRequest = bookingHoldStatusRequestSchema.parse(input);

    const emailDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(request.email, 'utf8')],
    });

    const result = await this.database.execute<StatusLookupRow & Record<string, unknown>>(
      sql`SELECT b.id            AS booking_id,
                 b.status        AS status,
                 b.hold_expires_at AS hold_expires_at
            FROM bookings b
            LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
           WHERE b.booking_code = ${request.bookingCode}
             AND (bc.email_digest IS NULL OR bc.email_digest = ${emailDigest})`,
    );
    const row = result.rows[0];
    if (row === undefined) {
      return bookingHoldStatusResponseSchema.parse({
        status: 'UNKNOWN',
        holdExpiresAt: null,
        serverTime: now.toISOString(),
      });
    }
    if (row.status === 'HOLD' && row.hold_expires_at !== null) {
      const expiresAt = parseSqlTimestamp(row.hold_expires_at, 'hold_expires_at');
      if (expiresAt.getTime() <= now.getTime()) {
        return bookingHoldStatusResponseSchema.parse({
          status: 'EXPIRED',
          holdExpiresAt: expiresAt.toISOString(),
          serverTime: now.toISOString(),
        });
      }
      return bookingHoldStatusResponseSchema.parse({
        status: 'HOLD',
        holdExpiresAt: expiresAt.toISOString(),
        serverTime: now.toISOString(),
      });
    }
    return bookingHoldStatusResponseSchema.parse({
      status: 'UNKNOWN',
      holdExpiresAt: null,
      serverTime: now.toISOString(),
    });
  }
}
```

## `apps/api/src/booking/services/booking-hold.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\booking-hold.service.ts`
- Lines: 169

### Top-level declarations / exports

- `export class BookingHoldError extends Error`
- `export class BookingHoldService`
- `export interface BookingHoldServiceOptions`
- `function couponSnapshotToResponse(`

### Function / method signatures

- `if (snapshot === undefined)`
- `private mapError(error: unknown): BookingHoldError`
- `public constructor(private readonly options: BookingHoldServiceOptions)`
- `super(message, options)`
- `switch (name)`

### Database tables / schema references

- `import { Buffer } from 'node:buffer';`
- `import { type DatabasePool } from '@room/database';`
- `return new BookingHoldError('ALLOCATION_BUSY', 'All free rooms are currently locked', {`
- `} from '@room/booking';`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `checkIn: result.checkIn.toISOString(),`
- `checkOut: result.checkOut.toISOString(),`
- `holdExpiresAt: result.holdExpiresAt.toISOString(),`

### Money / arithmetic operations

- `amountVnd: result.amountVnd,`
- `discountAmountVnd: snapshot.discountAmountVnd,`
- `finalAmountVnd: snapshot.finalAmountVnd,`
- `grossAmountVnd: snapshot.grossAmountVnd,`
- `import { type DatabasePool } from '@room/database';`
- `} from '@room/booking';`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import {
  createBookingHoldWithRetry,
  normalizeContact,
  type BookingHoldResult,
} from '@room/booking';
import {
  bookingHoldCouponSummarySchema,
  bookingHoldResponseSchema,
  createBookingHoldRequestSchema,
  type BookingHoldResponse,
  type BookingHoldCouponSummary,
} from '@room/contracts';
import { type DatabasePool } from '@room/database';

export class BookingHoldError extends Error {
  public constructor(
    public readonly code:
      | 'QUOTE_NOT_FOUND'
      | 'QUOTE_EXPIRED'
      | 'QUOTE_ALREADY_USED'
      | 'ROOM_TYPE_UNAVAILABLE'
      | 'ALLOCATION_BUSY'
      | 'STALE_HOLD_CLEANUP_RETRY'
      | 'COUPON_REQUOTE_REQUIRED'
      | 'COUPON_HOLD_WINDOW_INCOMPATIBLE'
      | 'COUPON_MINIMUM_NOT_MET'
      | 'COUPON_LIMIT_REACHED'
      | 'COUPON_CUSTOMER_LIMIT_REACHED'
      | 'COUPON_EXPIRED'
      | 'INTERNAL_ERROR',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BookingHoldError';
  }
}

export interface BookingHoldServiceOptions {
  readonly pool: DatabasePool;
  readonly holdDurationMs: number;
  readonly ipDigestSecret: Buffer;
}

function couponSnapshotToResponse(
  snapshot: BookingHoldResult['coupon'],
): BookingHoldCouponSummary | undefined {
  if (snapshot === undefined) return undefined;
  return bookingHoldCouponSummarySchema.parse({
    code: snapshot.code,
    discountType: snapshot.discountType,
    grossAmountVnd: snapshot.grossAmountVnd,
    discountAmountVnd: snapshot.discountAmountVnd,
    finalAmountVnd: snapshot.finalAmountVnd,
  });
}

export class BookingHoldService {
  public constructor(private readonly options: BookingHoldServiceOptions) {}

  public async issue(
    quoteId: string,
    input: unknown,
    correlationId: string,
    customerUserId?: string,
  ): Promise<BookingHoldResponse> {
    const request = createBookingHoldRequestSchema.parse(input);

    const contact = normalizeContact(request.contact, this.options.ipDigestSecret);

    let result: BookingHoldResult;
    try {
      result = await createBookingHoldWithRetry(this.options.pool, {
        quoteId,
        contact,
        holdDurationMs: this.options.holdDurationMs,
        correlationId,
        customerUserId,
      });
    } catch (error) {
      throw this.mapError(error);
    }
    return bookingHoldResponseSchema.parse({
      bookingId: result.bookingId,
      bookingCode: result.bookingCode,
      status: result.status,
      checkIn: result.checkIn.toISOString(),
      checkOut: result.checkOut.toISOString(),
      holdExpiresAt: result.holdExpiresAt.toISOString(),
      amountVnd: result.amountVnd,
      currency: result.currency,
      idempotent: result.idempotent,
      ...(result.coupon !== undefined ? { coupon: couponSnapshotToResponse(result.coupon) } : {}),
    });
  }

  private mapError(error: unknown): BookingHoldError {
    const name = error instanceof Error ? error.name : String(error);
    switch (name) {
      case 'QuoteNotFoundError':
        return new BookingHoldError('QUOTE_NOT_FOUND', 'Quote not found', { cause: error });
      case 'QuoteExpiredError':
        return new BookingHoldError('QUOTE_EXPIRED', 'Quote has expired', { cause: error });
      case 'QuoteAlreadyUsedError':
        return new BookingHoldError(
          'QUOTE_ALREADY_USED',
          'Quote already consumed by a different contact',
          { cause: error },
        );
      case 'RoomTypeUnavailableError':
        return new BookingHoldError(
          'ROOM_TYPE_UNAVAILABLE',
          'No eligible room is free for this interval',
          { cause: error },
        );
      case 'AllocationBusyError':
        return new BookingHoldError('ALLOCATION_BUSY', 'All free rooms are currently locked', {
          cause: error,
        });
      case 'StaleHoldCleanupRetryError':
        return new BookingHoldError(
          'STALE_HOLD_CLEANUP_RETRY',
          'Stale HOLD cleanup hit safety bound; retry shortly',
          { cause: error },
        );
      case 'CouponRequoteRequiredError':
        return new BookingHoldError(
          'COUPON_REQUOTE_REQUIRED',
          'Coupon terms changed; please request a new quote',
          { cause: error },
        );
      case 'CouponHoldWindowIncompatibleError':
        return new BookingHoldError(
          'COUPON_HOLD_WINDOW_INCOMPATIBLE',
          'Coupon is not valid for this hold window',
          { cause: error },
        );
      case 'CouponMinimumNotMetError':
        return new BookingHoldError(
          'COUPON_MINIMUM_NOT_MET',
          'Order total is below the coupon minimum',
          { cause: error },
        );
      case 'CouponLimitReachedError':
        return new BookingHoldError(
          'COUPON_LIMIT_REACHED',
          'Coupon total usage limit has been reached',
          { cause: error },
        );
      case 'CouponCustomerLimitReachedError':
        return new BookingHoldError(
          'COUPON_CUSTOMER_LIMIT_REACHED',
          'Coupon per-customer limit has been reached',
          { cause: error },
        );
      case 'CouponExpiredError':
        return new BookingHoldError(
          'COUPON_EXPIRED',
          'Coupon is no longer within its validity window',
          { cause: error },
        );
      default:
        return new BookingHoldError('INTERNAL_ERROR', 'Booking HOLD could not be created', {
          cause: error,
        });
    }
  }
}
```

## `apps/api/src/booking/services/guest-access-otp-request.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\guest-access-otp-request.service.ts`
- Lines: 86

### Top-level declarations / exports

- `export class GuestAccessOtpRequestService`
- `export class OtpBookingNotFoundError extends Error`
- `export class OtpRateLimitedError extends Error`

### Function / method signatures

- `if (outcome.kind === 'OTP_RATE_LIMITED')`
- `public constructor()`
- `public constructor(retryAfterSeconds: number)`
- `super('Booking not found for guest OTP request')`
- `super(\`OTP rate-limited; retry after ${retryAfterSeconds}s\`)`

### Database tables / schema references

- `import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';`
- `import { Buffer } from 'node:buffer';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `parts: [Buffer.from(request.email, 'utf8')],`
- `parts: [Buffer.from(requestIp, 'utf8')],`
- `} from '../repositories/guest-access.repository.js';`
- `} from '@room/contracts';`

### External HTTP calls

- `public async request(`

### Timezone / date handling

- `: new Date(outcome.serverTime.getTime() + this.config.otpTtlMs).toISOString(),`
- `? outcome.expiresAt.toISOString()`
- `now: new Date(),`
- `serverTime: outcome.serverTime.toISOString(),`

### Money / arithmetic operations

- `import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `} from '../repositories/guest-access.repository.js';`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import {
  guestAccessOtpRequestResponseSchema,
  guestAccessOtpRequestSchema,
  type GuestAccessOtpRequest,
  type GuestAccessOtpRequestResponse,
} from '@room/contracts';

import type {
  GuestAccessRateLimitConfig,
  GuestAccessSecrets,
} from '../repositories/guest-access.repository.js';
import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';

export class OtpRateLimitedError extends Error {
  public readonly code = 'OTP_RATE_LIMITED';
  public readonly retryAfterSeconds: number;
  public constructor(retryAfterSeconds: number) {
    super(`OTP rate-limited; retry after ${retryAfterSeconds}s`);
    this.name = 'OtpRateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OtpBookingNotFoundError extends Error {
  public readonly code = 'BOOKING_NOT_FOUND';
  public constructor() {
    super('Booking not found for guest OTP request');
    this.name = 'OtpBookingNotFoundError';
  }
}

export class GuestAccessOtpRequestService {
  public constructor(
    private readonly repository: GuestAccessRepository,
    private readonly secrets: GuestAccessSecrets,
    private readonly config: GuestAccessRateLimitConfig,
  ) {}

  public async request(input: unknown, requestIp: string): Promise<GuestAccessOtpRequestResponse> {
    const request: GuestAccessOtpRequest = guestAccessOtpRequestSchema.parse(input);

    const requestIpDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.ipRateLimit,
      parts: [Buffer.from(requestIp, 'utf8')],
    });

    const emailDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(request.email, 'utf8')],
    });

    const outcome = await this.repository.requestOtp({
      bookingCode: request.bookingCode,
      contact: {
        fullName: '',
        email: request.email,
        phoneE164: '',
        emailDigest,
      },
      requestIpDigest,
      now: new Date(),
    });

    if (outcome.kind === 'OTP_RATE_LIMITED') {
      throw new OtpRateLimitedError(outcome.retryAfterSeconds);
    }

    return guestAccessOtpRequestResponseSchema.parse({
      challengeRef: outcome.challengeRef,
      expiresAt:
        outcome.kind === 'CHALLENGE_ISSUED'
          ? outcome.expiresAt.toISOString()
          : new Date(outcome.serverTime.getTime() + this.config.otpTtlMs).toISOString(),
      cooldownSeconds: outcome.kind === 'CHALLENGE_ISSUED' ? outcome.cooldownSeconds : 0,
      serverTime: outcome.serverTime.toISOString(),
    });
  }
}
```

## `apps/api/src/booking/services/guest-access-otp-verify.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\guest-access-otp-verify.service.ts`
- Lines: 63

### Top-level declarations / exports

- `export class GuestAccessOtpVerifyService`
- `export class OtpInvalidOrExpiredError extends Error`

### Function / method signatures

- `if (outcome.kind !== 'CONSUMED')`
- `public constructor()`
- `super('OTP is invalid or expired')`

### Database tables / schema references

- `import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';`
- `import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';`
- `import { Buffer } from 'node:buffer';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `parts: [Buffer.from(requestIp, 'utf8')],`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `expiresAt: outcome.sessionExpiresAt.toISOString(),`
- `issuedAt: now.toISOString(),`

### Money / arithmetic operations

- `import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';`
- `import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import {
  guestAccessOtpVerifyResponseSchema,
  guestAccessOtpVerifySchema,
  type GuestAccessOtpVerify,
  type GuestAccessOtpVerifyResponse,
} from '@room/contracts';

import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';
import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';

export class OtpInvalidOrExpiredError extends Error {
  public readonly code = 'OTP_INVALID_OR_EXPIRED';
  public constructor() {
    super('OTP is invalid or expired');
    this.name = 'OtpInvalidOrExpiredError';
  }
}

export class GuestAccessOtpVerifyService {
  public constructor(
    private readonly repository: GuestAccessRepository,
    private readonly secrets: GuestAccessSecrets,
  ) {}

  public async verify(
    input: unknown,
    requestIp: string,
    now: Date,
  ): Promise<{
    response: GuestAccessOtpVerifyResponse;
    sessionToken: Buffer;
    bookingCode: string;
  }> {
    const request: GuestAccessOtpVerify = guestAccessOtpVerifySchema.parse(input);

    const requestIpDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.ipRateLimit,
      parts: [Buffer.from(requestIp, 'utf8')],
    });

    const outcome = await this.repository.consumeOtp({
      challengeRef: request.challengeRef,
      otp: request.otp,
      requestIpDigest,
      now,
    });

    if (outcome.kind !== 'CONSUMED') {
      throw new OtpInvalidOrExpiredError();
    }

    const response = guestAccessOtpVerifyResponseSchema.parse({
      bookingCode: outcome.bookingCode,
      expiresAt: outcome.sessionExpiresAt.toISOString(),
      issuedAt: now.toISOString(),
    });

    return { response, sessionToken: outcome.sessionToken, bookingCode: outcome.bookingCode };
  }
}
```

## `apps/api/src/booking/services/guest-logout.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\guest-logout.service.ts`
- Lines: 20

### Top-level declarations / exports

- `export class GuestLogoutService`

### Function / method signatures

- `if (sessionToken !== null)`
- `public async logout(sessionToken: Buffer | null, now: Date): Promise<GuestLogoutResponse>`

### Database tables / schema references

- `import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';`
- `import { Buffer } from 'node:buffer';`
- `import { GuestSessionService } from './guest-session.service.js';`
- `import { guestLogoutResponseSchema, type GuestLogoutResponse } from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `return guestLogoutResponseSchema.parse({ loggedOutAt: now.toISOString() });`

### Money / arithmetic operations

- `import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';`
- `import { GuestSessionService } from './guest-session.service.js';`
- `import { guestLogoutResponseSchema, type GuestLogoutResponse } from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import { guestLogoutResponseSchema, type GuestLogoutResponse } from '@room/contracts';

import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';
import { GuestSessionService } from './guest-session.service.js';

export class GuestLogoutService {
  public constructor(
    private readonly repository: GuestAccessRepository,
    private readonly session: GuestSessionService,
  ) {}

  public async logout(sessionToken: Buffer | null, now: Date): Promise<GuestLogoutResponse> {
    if (sessionToken !== null) {
      const digest = this.session.digestForRevoke(sessionToken);
      await this.repository.revokeSession({ tokenDigest: digest, now });
    }
    return guestLogoutResponseSchema.parse({ loggedOutAt: now.toISOString() });
  }
}
```

## `apps/api/src/booking/services/guest-session.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\booking\services\guest-session.service.ts`
- Lines: 81

### Top-level declarations / exports

- `export class GuestSessionInvalidError extends Error`
- `export class GuestSessionRequiredError extends Error`
- `export class GuestSessionService`
- `export class GuestSessionWrongBookingError extends Error`
- `export interface AuthenticatedSession`

### Function / method signatures

- `if (record === null) throw new GuestSessionInvalidError()`
- `if (session.bookingId !== expectedBookingId)`
- `if (token === null) return Promise.reject(new GuestSessionRequiredError())`
- `public authenticate(token: Buffer | null, now: Date): Promise<AuthenticatedSession>`
- `public constructor()`
- `public digestForRevoke(token: Buffer): Buffer`
- `super('Guest session cookie is required')`
- `super('Guest session is invalid, expired, or revoked')`
- `super('Guest session is not bound to this booking')`

### Database tables / schema references

- `import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';`
- `import { Buffer } from 'node:buffer';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `} from '../repositories/guest-session.repository.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';`
- `import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';`
- `} from '../repositories/guest-session.repository.js';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';

import {
  digestSessionToken,
  type GuestSessionRepository,
} from '../repositories/guest-session.repository.js';
import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';

export class GuestSessionRequiredError extends Error {
  public readonly code = 'GUEST_SESSION_REQUIRED';
  public constructor() {
    super('Guest session cookie is required');
    this.name = 'GuestSessionRequiredError';
  }
}

export class GuestSessionInvalidError extends Error {
  public readonly code = 'GUEST_SESSION_INVALID';
  public constructor() {
    super('Guest session is invalid, expired, or revoked');
    this.name = 'GuestSessionInvalidError';
  }
}

export class GuestSessionWrongBookingError extends Error {
  public readonly code = 'GUEST_SESSION_INVALID';
  public constructor() {
    super('Guest session is not bound to this booking');
    this.name = 'GuestSessionWrongBookingError';
  }
}

export interface AuthenticatedSession {
  readonly sessionId: string;
  readonly bookingId: string;
  readonly expiresAt: Date;
}

export class GuestSessionService {
  public constructor(
    private readonly repository: GuestSessionRepository,
    private readonly secrets: GuestAccessSecrets,
  ) {}

  public authenticate(token: Buffer | null, now: Date): Promise<AuthenticatedSession> {
    if (token === null) return Promise.reject(new GuestSessionRequiredError());
    const tokenDigest = digestSessionToken(this.secrets.sessionSecret, token);
    return this.repository.findActiveSession(tokenDigest, now).then((record) => {
      if (record === null) throw new GuestSessionInvalidError();
      return {
        sessionId: record.sessionId,
        bookingId: record.bookingId,
        expiresAt: record.expiresAt,
      };
    });
  }

  public requireForBooking(
    token: Buffer | null,
    expectedBookingId: string,
    now: Date,
  ): Promise<AuthenticatedSession> {
    return this.authenticate(token, now).then((session) => {
      if (session.bookingId !== expectedBookingId) {
        throw new GuestSessionWrongBookingError();
      }
      return session;
    });
  }

  public digestForRevoke(token: Buffer): Buffer {
    return computeDigest({
      secretKey: this.secrets.sessionSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
      parts: [token],
    });
  }
}
```

## `apps/api/src/customer/claim-booking.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\claim-booking.controller.ts`
- Lines: 86

### Top-level declarations / exports

- `export class ClaimBookingController`
- `function hashGuestToken(rawToken: string | null, secret: string): Buffer | null`
- `interface RequestLike`

### Function / method signatures

- `function hashGuestToken(rawToken: string | null, secret: string)`
- `if (cookieValue === null || secret.length < 32)`
- `if (error instanceof ClaimBookingError)`
- `if (parsed === null)`
- `if (rawToken === null || rawToken === '')`
- `if (tokenDigest === null)`

### Database tables / schema references

- `@Controller('customer/bookings')`
- `hmac.update(Buffer.from(secret, 'utf8'));`
- `hmac.update(parsed);`
- `import { ClaimBookingError, ClaimBookingService } from './claim-booking.service.js';`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`
- `import { createHash } from 'node:crypto';`
- `import { parseGuestSessionCookie } from '../booking/cookie.js';`
- `} from '@nestjs/common';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `@Controller('customer/bookings')`
- `@Post(':bookingCode/claim')`
- `import { ClaimBookingError, ClaimBookingService } from './claim-booking.service.js';`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`
- `import { parseGuestSessionCookie } from '../booking/cookie.js';`
- `} from '@nestjs/common';`

### Routing decorators / endpoint declarations

- `@Controller('customer/bookings')`
- `@HttpCode(HttpStatus.OK)`
- `@Param('bookingCode') bookingCode: string,`
- `@Post(':bookingCode/claim')`
- `@Req() request: RequestLike,`
- `@Version('1')`

### Verbatim source

```typescript
import { createHash } from 'node:crypto';
import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Version,
} from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import { ClaimBookingError, ClaimBookingService } from './claim-booking.service.js';
import { parseGuestSessionCookie } from '../booking/cookie.js';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly cookies?: Record<string, string | undefined>;
  readonly id: string;
}

function hashGuestToken(rawToken: string | null, secret: string): Buffer | null {
  if (rawToken === null || rawToken === '') return null;
  const parsed = parseGuestSessionCookie(rawToken);
  if (parsed === null) return null;
  const hmac = createHash('sha256');
  hmac.update(Buffer.from(secret, 'utf8'));
  hmac.update(parsed);
  return hmac.digest();
}

@Controller('customer/bookings')
export class ClaimBookingController {
  public constructor(
    @Inject(ClaimBookingService) private readonly claims: ClaimBookingService,
    @Inject(CustomerSessionService) private readonly sessions: CustomerSessionService,
  ) {}

  @Post(':bookingCode/claim')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  public async claim(@Param('bookingCode') bookingCode: string, @Req() request: RequestLike) {
    const actor = await this.sessions.requireCustomer(request);
    const cookieValue = request.cookies?.['rm_guest_session_v1'] ?? null;
    const secret = process.env['GUEST_SESSION_SECRET'] ?? '';
    if (cookieValue === null || secret.length < 32) {
      throw new HttpException({ code: 'GUEST_SESSION_REQUIRED' }, HttpStatus.UNAUTHORIZED);
    }
    const tokenDigest = hashGuestToken(cookieValue, secret);
    if (tokenDigest === null) {
      throw new HttpException({ code: 'GUEST_SESSION_MALFORMED' }, HttpStatus.UNAUTHORIZED);
    }
    try {
      return await this.claims.claim({
        bookingCode,
        userId: actor.userId,
        guestSessionTokenDigest: tokenDigest,
      });
    } catch (error) {
      if (error instanceof ClaimBookingError) {
        const statusByCode: Record<string, HttpStatus> = {
          BOOKING_NOT_FOUND: HttpStatus.NOT_FOUND,
          GUEST_SESSION_REQUIRED: HttpStatus.UNAUTHORIZED,
          GUEST_SESSION_MISMATCH: HttpStatus.FORBIDDEN,
          BOOKING_ALREADY_LINKED: HttpStatus.CONFLICT,
          CUSTOMER_NOT_FOUND: HttpStatus.UNAUTHORIZED,
          CUSTOMER_DISABLED: HttpStatus.FORBIDDEN,
        };
        const status = statusByCode[error.code] ?? HttpStatus.BAD_REQUEST;
        throw new HttpException({ code: error.code, message: error.message }, status);
      }
      throw error;
    }
  }
}
```

## `apps/api/src/customer/claim-booking.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\claim-booking.service.ts`
- Lines: 176

### Top-level declarations / exports

- `export class ClaimBookingError extends Error`
- `export class ClaimBookingService`
- `export interface ClaimBookingInput`
- `export interface ClaimBookingResult`
- `export interface ClaimBookingServiceOptions`
- `type DbTransaction`

### Function / method signatures

- `if (booking === undefined)`
- `if (booking.customerUserId === null)`
- `if (customerRow === undefined)`
- `if (customerRow.status !== 'ACTIVE')`
- `if (input.guestSessionTokenDigest === null)`
- `if (normalized.length === 0)`
- `if (sessionRow === undefined || sessionRow.bookingId !== booking.id)`
- `public async claim(input: ClaimBookingInput): Promise<ClaimBookingResult>`
- `public constructor(private readonly options: ClaimBookingServiceOptions)`
- `super(message)`

### Database tables / schema references

- `.from(bookingContacts)`
- `.from(bookings)`
- `.from(guestSessions)`
- `.from(users)`
- `.select({ bookingId: guestSessions.bookingId })`
- `.select({ id: bookingContacts.id })`
- `.select({ id: users.id, email: users.email, status: users.status })`
- `.update(bookings)`
- `.where(eq(bookings.bookingCode, input.bookingCode))`
- `.where(eq(bookings.id, booking.id));`
- `.where(eq(users.id, input.userId))`
- `: eq(guestSessions.tokenDigest, input.guestSessionTokenDigest),`
- `auditEvents,`
- `await tx.insert(auditEvents).values({`
- `bookingCode: bookings.bookingCode,`
- `bookingContacts,`
- `bookings,`
- `customerUserId: bookings.customerUserId,`
- `guestSessions,`
- `id: bookings.id,`
- `propertyId: bookings.propertyId,`
- `sql\`${bookingContacts.bookingId} = ${bookingId} AND lower(${bookingContacts.normalizedEmail}) = ${normalized}\`,`
- `users,`
- `} from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `.set({ customerUserId: input.userId, updatedAt: new Date() })`

### Money / arithmetic operations

- `*`
- `*   only — never sufficient on its own to claim.`
- `* - Email equivalence with booking contact is recorded as audit metadata`
- `* - If already linked to the same CUSTOMER, idempotent success.`
- `* - If booking is not yet linked, set customer_user_id.`
- `* - If linked to a different customer, BOOKING_ALREADY_LINKED (409).`
- `* Links a guest booking to the CUSTOMER's user id once the CUSTOMER proves`
- `* Rules:`
- `* possession through the booking-scoped guest session.`
- `*/`
- `/**`
- `} from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import {
  auditEvents,
  bookingContacts,
  bookings,
  guestSessions,
  type DatabaseClient,
  eq,
  sql,
  users,
} from '@room/database';

export class ClaimBookingError extends Error {
  public constructor(
    public readonly code:
      | 'BOOKING_NOT_FOUND'
      | 'GUEST_SESSION_REQUIRED'
      | 'GUEST_SESSION_MISMATCH'
      | 'BOOKING_ALREADY_LINKED'
      | 'CUSTOMER_NOT_FOUND'
      | 'CUSTOMER_DISABLED',
    message: string,
  ) {
    super(message);
    this.name = 'ClaimBookingError';
  }
}

export interface ClaimBookingServiceOptions {
  readonly database: DatabaseClient;
}

export interface ClaimBookingInput {
  readonly bookingCode: string;
  readonly userId: string;
  readonly guestSessionTokenDigest: Buffer | null;
}

export interface ClaimBookingResult {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly wasAlreadyClaimed: boolean;
}

type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

/**
 * Links a guest booking to the CUSTOMER's user id once the CUSTOMER proves
 * possession through the booking-scoped guest session.
 *
 * Rules:
 * - If booking is not yet linked, set customer_user_id.
 * - If already linked to the same CUSTOMER, idempotent success.
 * - If linked to a different customer, BOOKING_ALREADY_LINKED (409).
 * - Email equivalence with booking contact is recorded as audit metadata
 *   only — never sufficient on its own to claim.
 */
export class ClaimBookingService {
  public constructor(private readonly options: ClaimBookingServiceOptions) {}

  public async claim(input: ClaimBookingInput): Promise<ClaimBookingResult> {
    if (input.guestSessionTokenDigest === null) {
      throw new ClaimBookingError(
        'GUEST_SESSION_REQUIRED',
        'A guest session bound to the booking is required to claim',
      );
    }

    const customer = await this.options.database
      .select({ id: users.id, email: users.email, status: users.status })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    const customerRow = customer[0];
    if (customerRow === undefined) {
      throw new ClaimBookingError('CUSTOMER_NOT_FOUND', 'CUSTOMER user not found');
    }
    if (customerRow.status !== 'ACTIVE') {
      throw new ClaimBookingError('CUSTOMER_DISABLED', 'CUSTOMER account is not ACTIVE');
    }

    return this.options.database.transaction(async (tx: DbTransaction) => {
      const bookingRows = await tx
        .select({
          id: bookings.id,
          propertyId: bookings.propertyId,
          bookingCode: bookings.bookingCode,
          customerUserId: bookings.customerUserId,
        })
        .from(bookings)
        .where(eq(bookings.bookingCode, input.bookingCode))
        .limit(1)
        .for('update');
      const booking = bookingRows[0];
      if (booking === undefined) {
        throw new ClaimBookingError('BOOKING_NOT_FOUND', 'Booking not found');
      }

      const sessionRows = await tx
        .select({ bookingId: guestSessions.bookingId })
        .from(guestSessions)
        .where(
          input.guestSessionTokenDigest === null
            ? sql`false`
            : eq(guestSessions.tokenDigest, input.guestSessionTokenDigest),
        )
        .limit(1);
      const sessionRow = sessionRows[0];
      if (sessionRow === undefined || sessionRow.bookingId !== booking.id) {
        throw new ClaimBookingError(
          'GUEST_SESSION_MISMATCH',
          'Guest session does not bound the requested booking',
        );
      }

      let wasAlreadyClaimed = false;
      if (booking.customerUserId === null) {
        await tx
          .update(bookings)
          .set({ customerUserId: input.userId, updatedAt: new Date() })
          .where(eq(bookings.id, booking.id));
      } else if (booking.customerUserId === input.userId) {
        wasAlreadyClaimed = true;
      } else {
        throw new ClaimBookingError(
          'BOOKING_ALREADY_LINKED',
          'Booking is already linked to another CUSTOMER account',
        );
      }

      const supportingMatch = await this.checkSupportingEmailMatch(
        tx,
        booking.id,
        customerRow.email,
      );

      await tx.insert(auditEvents).values({
        propertyId: booking.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: booking.id,
        eventType: 'BOOKING_CLAIMED',
        actorType: 'CUSTOMER',
        actorId: input.userId,
        payload: {
          bookingCode: booking.bookingCode,
          supportingMatch,
          idempotent: wasAlreadyClaimed,
        },
      });

      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        wasAlreadyClaimed,
      };
    });
  }

  private async checkSupportingEmailMatch(
    tx: DbTransaction,
    bookingId: string,
    normalizedEmail: string,
  ): Promise<boolean> {
    const normalized = normalizedEmail.trim().toLowerCase();
    if (normalized.length === 0) return false;
    const matches = await tx
      .select({ id: bookingContacts.id })
      .from(bookingContacts)
      .where(
        sql`${bookingContacts.bookingId} = ${bookingId} AND lower(${bookingContacts.normalizedEmail}) = ${normalized}`,
      )
      .limit(1);
    return matches.length > 0;
  }
}
```

## `apps/api/src/customer/customer-audit.adapter.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer-audit.adapter.ts`
- Lines: 32

### Top-level declarations / exports

- `export class CustomerAuditAdapter implements CustomerAuditRecorder`

### Function / method signatures

- `public constructor(private readonly database: DatabaseClient)`

### Database tables / schema references

- `await this.database.insert(auditEvents).values({`
- `import type { CustomerAuditRecorder } from './customer-profile.service.js';`
- `import { auditEvents, type DatabaseClient } from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `* Payload contains only field names that changed — never phone numbers,`
- `* Thin adapter that maps CUSTOMER profile mutations to the audit log.`
- `* addresses, or emails.`
- `*/`
- `/**`
- `import type { CustomerAuditRecorder } from './customer-profile.service.js';`
- `import { auditEvents, type DatabaseClient } from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { auditEvents, type DatabaseClient } from '@room/database';

import type { CustomerAuditRecorder } from './customer-profile.service.js';

/**
 * Thin adapter that maps CUSTOMER profile mutations to the audit log.
 * Payload contains only field names that changed — never phone numbers,
 * addresses, or emails.
 */
export class CustomerAuditAdapter implements CustomerAuditRecorder {
  public constructor(private readonly database: DatabaseClient) {}

  public async write(input: {
    propertyId: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    actorType: 'CUSTOMER' | 'GUEST' | 'ADMIN' | 'SYSTEM';
    actorId: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.database.insert(auditEvents).values({
      propertyId: input.propertyId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId,
      payload: input.payload,
    });
  }
}
```

## `apps/api/src/customer/customer-booking.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer-booking.service.ts`
- Lines: 140

### Top-level declarations / exports

- `export class CustomerBookingNotFoundError extends Error`
- `export class CustomerBookingService`
- `export interface CustomerBookingDetail`
- `export interface CustomerBookingListResult`
- `export interface CustomerBookingSummary`

### Function / method signatures

- `if (row === undefined)`
- `public constructor()`
- `public constructor(private readonly database: DatabaseClient)`
- `super('Booking not found for this CUSTOMER')`

### Database tables / schema references

- `.from(bookings)`
- `.from(payments)`
- `.orderBy(sql\`${bookings.createdAt} DESC\`, sql\`${bookings.id} DESC\`)`
- `.select({ status: payments.status })`
- `.where(eq(bookings.customerUserId, userId))`
- `.where(eq(payments.bookingId, row.id))`
- `// Authoritative payment status is derived from the \`payments\` table.`
- `// The \`payments\` row is the single source of truth for the booking's`
- `// surface here intentionally exposes the customer-facing \`payments\``
- `bookingCode: bookings.bookingCode,`
- `bookings,`
- `checkIn: bookings.checkIn,`
- `checkOut: bookings.checkOut,`
- `createdAt: bookings.createdAt,`
- `currency: bookings.currency,`
- `discountAmountVnd: bookings.discountAmountVnd,`
- `finalAmountVnd: bookings.finalAmountVnd,`
- `grossAmountVnd: bookings.grossAmountVnd,`
- `id: bookings.id,`
- `payments,`
- `sql\`${bookings.bookingCode} = ${bookingCode} AND ${bookings.customerUserId} = ${userId}\`,`
- `status: bookings.status,`
- `} from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `checkIn: row.checkIn.toISOString(),`
- `checkOut: row.checkOut.toISOString(),`
- `createdAt: row.createdAt.toISOString(),`

### Money / arithmetic operations

- `// Authoritative payment status is derived from the \`payments\` table.`
- `// The \`payment_attempts\` table is the provider-side state; the`
- `// The \`payments\` row is the single source of truth for the booking's`
- `// lifecycle so provider attempt IDs, raw provider event payloads, and`
- `// no payment row yet (HOLD, payment not initiated) returns 'NONE'.`
- `// outbox/audit envelopes never leak through the CUSTOMER route.`
- `// payment state; it is uniquely keyed by \`booking_id\`. A booking with`
- `// surface here intentionally exposes the customer-facing \`payments\``
- `discountAmountVnd: bookings.discountAmountVnd,`
- `discountAmountVnd: row.discountAmountVnd.toString(),`
- `finalAmountVnd: bookings.finalAmountVnd,`
- `finalAmountVnd: row.finalAmountVnd.toString(),`
- `grossAmountVnd: bookings.grossAmountVnd,`
- `grossAmountVnd: row.grossAmountVnd.toString(),`
- `readonly discountAmountVnd: string;`
- `readonly finalAmountVnd: string;`
- `readonly grossAmountVnd: string;`
- `} from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { bookings, type DatabaseClient, eq, payments, sql } from '@room/database';

export interface CustomerBookingSummary {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly currency: string;
  readonly finalAmountVnd: string;
  readonly createdAt: string;
}

export interface CustomerBookingListResult {
  readonly items: readonly CustomerBookingSummary[];
  readonly nextCursor: string | null;
}

export interface CustomerBookingDetail {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly currency: string;
  readonly grossAmountVnd: string;
  readonly discountAmountVnd: string;
  readonly finalAmountVnd: string;
  readonly paymentStatus: string;
  readonly createdAt: string;
}

export class CustomerBookingNotFoundError extends Error {
  public constructor() {
    super('Booking not found for this CUSTOMER');
    this.name = 'CustomerBookingNotFoundError';
  }
}

export class CustomerBookingService {
  public constructor(private readonly database: DatabaseClient) {}

  public async listForCustomer(
    userId: string,
    options: { limit: number },
  ): Promise<CustomerBookingListResult> {
    const rows = await this.database
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        currency: bookings.currency,
        finalAmountVnd: bookings.finalAmountVnd,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .where(eq(bookings.customerUserId, userId))
      .orderBy(sql`${bookings.createdAt} DESC`, sql`${bookings.id} DESC`)
      .limit(options.limit + 1);
    const items = rows.slice(0, options.limit).map((row) => ({
      bookingId: row.id,
      bookingCode: row.bookingCode,
      status: row.status,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      currency: row.currency,
      finalAmountVnd: row.finalAmountVnd.toString(),
      createdAt: row.createdAt.toISOString(),
    }));
    const hasMore = rows.length > options.limit;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last !== undefined ? `${last.createdAt}|${last.bookingId}` : null;
    return { items, nextCursor };
  }

  public async detailForCustomer(
    userId: string,
    bookingCode: string,
  ): Promise<CustomerBookingDetail> {
    const bookingRows = await this.database
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        currency: bookings.currency,
        grossAmountVnd: bookings.grossAmountVnd,
        discountAmountVnd: bookings.discountAmountVnd,
        finalAmountVnd: bookings.finalAmountVnd,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .where(
        sql`${bookings.bookingCode} = ${bookingCode} AND ${bookings.customerUserId} = ${userId}`,
      )
      .limit(1);
    const row = bookingRows[0];
    if (row === undefined) {
      throw new CustomerBookingNotFoundError();
    }
    // Authoritative payment status is derived from the `payments` table.
    // The `payments` row is the single source of truth for the booking's
    // payment state; it is uniquely keyed by `booking_id`. A booking with
    // no payment row yet (HOLD, payment not initiated) returns 'NONE'.
    // The `payment_attempts` table is the provider-side state; the
    // surface here intentionally exposes the customer-facing `payments`
    // lifecycle so provider attempt IDs, raw provider event payloads, and
    // outbox/audit envelopes never leak through the CUSTOMER route.
    const paymentRows = await this.database
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.bookingId, row.id))
      .limit(1);
    const paymentRow = paymentRows[0];
    const paymentStatus = paymentRow?.status ?? 'NONE';
    return {
      bookingId: row.id,
      bookingCode: row.bookingCode,
      status: row.status,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      currency: row.currency,
      grossAmountVnd: row.grossAmountVnd.toString(),
      discountAmountVnd: row.discountAmountVnd.toString(),
      finalAmountVnd: row.finalAmountVnd.toString(),
      paymentStatus,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
```

## `apps/api/src/customer/customer-bookings.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer-bookings.controller.ts`
- Lines: 69

### Top-level declarations / exports

- `const DEFAULT_LIMIT`
- `const MAX_LIMIT`
- `export class CustomerBookingsController`
- `function clampLimit(rawLimit: string | undefined): number`
- `interface RequestLike`

### Function / method signatures

- `function clampLimit(rawLimit: string | undefined)`
- `if (!Number.isFinite(value) || value <= 0)`
- `if (error instanceof CustomerBookingNotFoundError)`
- `if (rawLimit === undefined)`

### Database tables / schema references

- `@Controller('customer/bookings')`
- `@Inject(CustomerBookingService) private readonly bookings: CustomerBookingService,`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`
- `return await this.bookings.detailForCustomer(actor.userId, bookingCode);`
- `return this.bookings.listForCustomer(actor.userId, { limit });`
- `} from './customer-booking.service.js';`
- `} from '@nestjs/common';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `@Controller('customer/bookings')`
- `const value = Number.parseInt(rawLimit, 10);`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`
- `} from './customer-booking.service.js';`
- `} from '@nestjs/common';`

### Routing decorators / endpoint declarations

- `@Controller('customer/bookings')`
- `@Get(':bookingCode')`
- `@Get()`
- `@Param('bookingCode') bookingCode: string,`
- `@Query('cursor') _cursor?: string,`
- `@Query('limit') rawLimit?: string,`
- `@Req() request: RequestLike,`
- `@Version('1')`

### Verbatim source

```typescript
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Query,
  Req,
  Version,
} from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import {
  CustomerBookingNotFoundError,
  CustomerBookingService,
} from './customer-booking.service.js';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly id: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Controller('customer/bookings')
export class CustomerBookingsController {
  public constructor(
    @Inject(CustomerBookingService) private readonly bookings: CustomerBookingService,
    @Inject(CustomerSessionService) private readonly sessions: CustomerSessionService,
  ) {}

  @Get()
  @Version('1')
  public async list(
    @Req() request: RequestLike,
    @Query('limit') rawLimit?: string,
    @Query('cursor') _cursor?: string,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    const limit = clampLimit(rawLimit);
    return this.bookings.listForCustomer(actor.userId, { limit });
  }

  @Get(':bookingCode')
  @Version('1')
  public async detail(@Req() request: RequestLike, @Param('bookingCode') bookingCode: string) {
    const actor = await this.sessions.requireCustomer(request);
    try {
      return await this.bookings.detailForCustomer(actor.userId, bookingCode);
    } catch (error) {
      if (error instanceof CustomerBookingNotFoundError) {
        throw new HttpException({ code: 'BOOKING_NOT_FOUND' }, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }
}

function clampLimit(rawLimit: string | undefined): number {
  if (rawLimit === undefined) return DEFAULT_LIMIT;
  const value = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}
```

## `apps/api/src/customer/customer-profile.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer-profile.controller.ts`
- Lines: 67

### Top-level declarations / exports

- `export class CustomerProfileController`
- `interface RequestLike`

### Function / method signatures

- `if (error instanceof CustomerProfileValidationError)`
- `if (profile === null)`
- `public async get(@Req() request: RequestLike)`

### Database tables / schema references

- `import { CustomerProfileService } from './customer-profile.service.js';`
- `import { CustomerProfileValidationError } from './customer-profile.schema.js';`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`
- `import { parseCustomerProfilePatch } from './customer-profile.schema.js';`
- `} from '@nestjs/common';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `@Controller('customer/profile')`
- `import { CustomerProfileService } from './customer-profile.service.js';`
- `import { CustomerProfileValidationError } from './customer-profile.schema.js';`
- `import { CustomerSessionService } from '../auth/customer-session.service.js';`
- `import { parseCustomerProfilePatch } from './customer-profile.schema.js';`
- `} from '@nestjs/common';`

### Routing decorators / endpoint declarations

- `@Body() body: unknown,`
- `@Controller('customer/profile')`
- `@Get()`
- `@HttpCode(HttpStatus.OK)`
- `@Patch()`
- `@Req() request: RequestLike,`
- `@Version('1')`

### Verbatim source

```typescript
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Req,
  UnauthorizedException,
  Version,
} from '@nestjs/common';

import { parseCustomerProfilePatch } from './customer-profile.schema.js';
import { CustomerProfileValidationError } from './customer-profile.schema.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { CustomerSessionService } from '../auth/customer-session.service.js';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly id: string;
}

@Controller('customer/profile')
export class CustomerProfileController {
  public constructor(
    @Inject(CustomerProfileService) private readonly profiles: CustomerProfileService,
    @Inject(CustomerSessionService) private readonly sessions: CustomerSessionService,
  ) {}

  @Get()
  @Version('1')
  public async get(@Req() request: RequestLike) {
    const actor = await this.sessions.requireCustomer(request);
    const profile = await this.profiles.getProfile(actor.userId);
    if (profile === null) {
      throw new UnauthorizedException({ code: 'CUSTOMER_PROFILE_NOT_FOUND' });
    }
    return profile;
  }

  @Patch()
  @Version('1')
  @HttpCode(HttpStatus.OK)
  public async patch(@Req() request: RequestLike, @Body() body: unknown) {
    const actor = await this.sessions.requireCustomer(request);
    let patch;
    try {
      patch = parseCustomerProfilePatch(body);
    } catch (error) {
      if (error instanceof CustomerProfileValidationError) {
        throw new UnauthorizedException({
          code: 'CUSTOMER_PROFILE_INVALID',
          issues: error.issues,
        });
      }
      throw error;
    }
    return this.profiles.patchProfile(actor.userId, patch, {
      actorId: actor.userId,
      requestId: actor.requestId,
    });
  }
}
```

## `apps/api/src/customer/customer-profile.schema.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer-profile.schema.ts`
- Lines: 99

### Top-level declarations / exports

- `const COUNTRY_PATTERN`
- `const PHONE_PATTERN`
- `export class CustomerProfileValidationError extends Error`
- `export function parseCustomerProfilePatch(input: unknown): CustomerProfilePatchInput`
- `export interface CustomerProfilePatchInput`
- `function throwIssues(issues: readonly string[]): never`
- `function trimOrNull(value: unknown, max: number): string | null`
- `function validatePhone(value: unknown):`

### Function / method signatures

- `export function parseCustomerProfilePatch(input: unknown)`
- `function throwIssues(issues: readonly string[])`
- `function trimOrNull(value: unknown, max: number)`
- `function validatePhone(value: unknown)`
- `if (!PHONE_PATTERN.test(trimmed))`
- `if (!phone.ok) issues.push(phone.reason)`
- `if (country === undefined)`
- `if (issues.length > 0)`
- `if (trimmed.length === 0)`
- `if (trimmed.length === 0) issues.push('Name must not be empty')`
- `if (trimmed.length > 120) issues.push('Name must be 120 characters or fewer')`
- `if (trimmed.length > 32)`
- `if (typeof input !== 'object' || input === null)`
- `if (typeof nameRaw !== 'string')`
- `if (typeof phoneLengthCheck === 'string' && (phoneLengthCheck as string).length > 32)`
- `if (typeof value !== 'string')`
- `if (value === null || value === undefined)`
- `public constructor(issues: readonly string[])`
- `super(\`Invalid customer profile payload: ${issues.join(', ')}\`)`
- `throwIssues(['Patch payload must be an object'])`
- `throwIssues(issues)`

### Database tables / schema references

- None detected by static scan.

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `const COUNTRY_PATTERN = /^[A-Z]{2}$/;`
- `const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
export class CustomerProfileValidationError extends Error {
  public readonly issues: readonly string[] = [];
  public constructor(issues: readonly string[]) {
    super(`Invalid customer profile payload: ${issues.join(', ')}`);
    this.name = 'CustomerProfileValidationError';
    this.issues = issues;
  }
}

export interface CustomerProfilePatchInput {
  readonly name?: string;
  readonly phone?: string | null;
  readonly addressLine1?: string | null;
  readonly addressLine2?: string | null;
  readonly ward?: string | null;
  readonly district?: string | null;
  readonly province?: string | null;
  readonly postalCode?: string | null;
  readonly countryCode?: string;
}

const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

function trimOrNull(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function validatePhone(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; reason: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, reason: 'Phone must be a string' };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 32) return { ok: false, reason: 'Phone must not exceed 32 characters' };
  if (!PHONE_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'Phone must be in E.164 format (e.g. +84901234567)' };
  }
  return { ok: true, value: trimmed };
}

export function parseCustomerProfilePatch(input: unknown): CustomerProfilePatchInput {
  if (typeof input !== 'object' || input === null) {
    throwIssues(['Patch payload must be an object']);
  }
  const body = input as Record<string, unknown>;
  const issues: string[] = [];
  const out: Record<string, unknown> = {};

  const nameRaw = body['name'];
  if (typeof nameRaw !== 'string') {
    issues.push('Name is required');
  } else {
    const trimmed = nameRaw.trim();
    if (trimmed.length === 0) issues.push('Name must not be empty');
    if (trimmed.length > 120) issues.push('Name must be 120 characters or fewer');
    out['name'] = trimmed;
  }

  const phone = validatePhone(body['phone']);
  if (!phone.ok) issues.push(phone.reason);
  else out['phone'] = phone.value;

  const phoneLengthCheck = out['phone'];
  if (typeof phoneLengthCheck === 'string' && (phoneLengthCheck as string).length > 32) {
    issues.push('Phone must not exceed 32 characters');
  }

  for (const [field, max] of [
    ['addressLine1', 200],
    ['addressLine2', 200],
    ['ward', 200],
    ['district', 200],
    ['province', 200],
    ['postalCode', 32],
  ] as const) {
    out[field] = trimOrNull(body[field], max);
  }

  const country = body['countryCode'];
  if (country === undefined) {
    out['countryCode'] = 'VN';
  } else if (typeof country !== 'string' || !COUNTRY_PATTERN.test(country)) {
    issues.push('Country code must be a 2-letter ISO code');
  } else {
    out['countryCode'] = country;
  }

  if (issues.length > 0) {
    throwIssues(issues);
  }
  return out as CustomerProfilePatchInput;
}

function throwIssues(issues: readonly string[]): never {
  throw new CustomerProfileValidationError(issues);
}
```

## `apps/api/src/customer/customer-profile.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer-profile.service.ts`
- Lines: 186

### Top-level declarations / exports

- `export class CustomerProfileService`
- `export interface CustomerAuditRecorder`
- `export interface CustomerProfile`

### Function / method signatures

- `if (patch.addressLine1 !== undefined) changed.push('addressLine1')`
- `if (patch.addressLine2 !== undefined) changed.push('addressLine2')`
- `if (patch.countryCode !== undefined && patch.countryCode !== 'VN')`
- `if (patch.district !== undefined) changed.push('district')`
- `if (patch.name !== undefined) changed.push('name')`
- `if (patch.phone !== undefined) changed.push('phone')`
- `if (patch.postalCode !== undefined) changed.push('postalCode')`
- `if (patch.province !== undefined) changed.push('province')`
- `if (patch.ward !== undefined) changed.push('ward')`
- `if (profileRow === undefined)`
- `if (result === null)`
- `if (row === undefined)`
- `if (userRow === undefined)`
- `public async getProfile(userId: string): Promise<CustomerProfile | null>`

### Database tables / schema references

- `.from(users)`
- `.insert(customerProfiles)`
- `.leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))`
- `.onConflictDoUpdate({`
- `.returning({ id: users.id });`
- `.returning({ userId: customerProfiles.userId });`
- `.update(users)`
- `.where(eq(users.id, userId))`
- `addressLine1: customerProfiles.addressLine1,`
- `addressLine2: customerProfiles.addressLine2,`
- `const profileUpdate = await tx`
- `const userUpdate = await tx`
- `countryCode: customerProfiles.countryCode,`
- `customerProfiles,`
- `district: customerProfiles.district,`
- `email: users.email,`
- `import type { CustomerProfilePatchInput } from './customer-profile.schema.js';`
- `name: users.name,`
- `phone: customerProfiles.normalizedPhoneE164,`
- `postalCode: customerProfiles.postalCode,`
- `province: customerProfiles.province,`
- `target: customerProfiles.userId,`
- `updatedAt: customerProfiles.updatedAt,`
- `userId: users.id,`
- `users,`
- `ward: customerProfiles.ward,`
- `} from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `.set({ name: patch.name, updatedAt: new Date() })`
- `updatedAt: (row.updatedAt ?? new Date()).toISOString(),`

### Money / arithmetic operations

- `* ACTIVE CUSTOMER user. The CUSTOMER row itself supplies the authoritative`
- `* Reads and patches the customer_profiles row associated with the given`
- `* email and display name. Email cannot be modified through this surface.`
- `*/`
- `/**`
- `import type { CustomerProfilePatchInput } from './customer-profile.schema.js';`
- `} from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { customerProfiles, type DatabaseClient, eq, sql, users } from '@room/database';

import type { CustomerProfilePatchInput } from './customer-profile.schema.js';

export interface CustomerProfile {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly phone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly ward: string | null;
  readonly district: string | null;
  readonly province: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly updatedAt: string;
}

export interface CustomerAuditRecorder {
  write(input: {
    propertyId: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    actorType: 'CUSTOMER' | 'GUEST' | 'ADMIN' | 'SYSTEM';
    actorId: string | null;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * Reads and patches the customer_profiles row associated with the given
 * ACTIVE CUSTOMER user. The CUSTOMER row itself supplies the authoritative
 * email and display name. Email cannot be modified through this surface.
 */
export class CustomerProfileService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly audit: CustomerAuditRecorder,
  ) {}

  public async getProfile(userId: string): Promise<CustomerProfile | null> {
    const rows = await this.database
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        phone: customerProfiles.normalizedPhoneE164,
        addressLine1: customerProfiles.addressLine1,
        addressLine2: customerProfiles.addressLine2,
        ward: customerProfiles.ward,
        district: customerProfiles.district,
        province: customerProfiles.province,
        postalCode: customerProfiles.postalCode,
        countryCode: customerProfiles.countryCode,
        updatedAt: customerProfiles.updatedAt,
      })
      .from(users)
      .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return this.toResponse(row);
  }

  public async patchProfile(
    userId: string,
    patch: CustomerProfilePatchInput,
    actor: { readonly actorId: string; readonly requestId: string },
  ): Promise<CustomerProfile> {
    const countryCode = patch.countryCode ?? 'VN';
    const changed: string[] = [];
    if (patch.name !== undefined) changed.push('name');
    if (patch.phone !== undefined) changed.push('phone');
    if (patch.addressLine1 !== undefined) changed.push('addressLine1');
    if (patch.addressLine2 !== undefined) changed.push('addressLine2');
    if (patch.ward !== undefined) changed.push('ward');
    if (patch.district !== undefined) changed.push('district');
    if (patch.province !== undefined) changed.push('province');
    if (patch.postalCode !== undefined) changed.push('postalCode');
    if (patch.countryCode !== undefined && patch.countryCode !== 'VN') {
      changed.push('countryCode');
    }

    const updated = await this.database.transaction(async (tx) => {
      const userUpdate = await tx
        .update(users)
        .set({ name: patch.name, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      const userRow = userUpdate[0];
      if (userRow === undefined) {
        throw new Error('Customer not found');
      }
      const profileUpdate = await tx
        .insert(customerProfiles)
        .values({
          userId,
          normalizedPhoneE164: patch.phone ?? null,
          addressLine1: patch.addressLine1 ?? null,
          addressLine2: patch.addressLine2 ?? null,
          ward: patch.ward ?? null,
          district: patch.district ?? null,
          province: patch.province ?? null,
          postalCode: patch.postalCode ?? null,
          countryCode,
        })
        .onConflictDoUpdate({
          target: customerProfiles.userId,
          set: {
            normalizedPhoneE164: patch.phone ?? null,
            addressLine1: patch.addressLine1 ?? null,
            addressLine2: patch.addressLine2 ?? null,
            ward: patch.ward ?? null,
            district: patch.district ?? null,
            province: patch.province ?? null,
            postalCode: patch.postalCode ?? null,
            countryCode,
            updatedAt: sql`now()`,
          },
        })
        .returning({ userId: customerProfiles.userId });
      const profileRow = profileUpdate[0];
      if (profileRow === undefined) {
        throw new Error('Customer profile upsert did not return a row');
      }
      return profileRow.userId;
    });

    await this.audit.write({
      propertyId: null,
      aggregateType: 'CUSTOMER_PROFILE',
      aggregateId: userId,
      eventType: 'CUSTOMER_PROFILE_UPDATED',
      actorType: 'CUSTOMER',
      actorId: actor.actorId,
      payload: { changedFields: changed },
    });

    const result = await this.getProfile(updated);
    if (result === null) {
      throw new Error('Customer profile vanished after update');
    }
    return result;
  }

  private toResponse(row: {
    userId: string;
    email: string;
    name: string;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    ward: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;
    countryCode: string | null;
    updatedAt: Date | null;
  }): CustomerProfile {
    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      phone: row.phone,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      ward: row.ward,
      district: row.district,
      province: row.province,
      postalCode: row.postalCode,
      countryCode: row.countryCode ?? 'VN',
      updatedAt: (row.updatedAt ?? new Date()).toISOString(),
    };
  }
}
```

## `apps/api/src/customer/customer.module.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\customer\customer.module.ts`
- Lines: 57

### Top-level declarations / exports

- `export class CustomerModule`
- `export const CUSTOMER_AUDIT_ADAPTER`

### Function / method signatures

- None detected by static scan.

### Database tables / schema references

- `import { AppDatabaseModule } from '../database/database.module.js';`
- `import { AuthModule } from '../auth/auth.module.js';`
- `import { ClaimBookingController } from './claim-booking.controller.js';`
- `import { ClaimBookingService } from './claim-booking.service.js';`
- `import { CustomerAuditAdapter } from './customer-audit.adapter.js';`
- `import { CustomerBookingService } from './customer-booking.service.js';`
- `import { CustomerBookingsController } from './customer-bookings.controller.js';`
- `import { CustomerProfileController } from './customer-profile.controller.js';`
- `import { CustomerProfileService } from './customer-profile.service.js';`
- `import { DatabaseProvider } from '../database/database.provider.js';`
- `import { Module } from '@nestjs/common';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `import { AppDatabaseModule } from '../database/database.module.js';`
- `import { AuthModule } from '../auth/auth.module.js';`
- `import { ClaimBookingController } from './claim-booking.controller.js';`
- `import { ClaimBookingService } from './claim-booking.service.js';`
- `import { CustomerAuditAdapter } from './customer-audit.adapter.js';`
- `import { CustomerBookingService } from './customer-booking.service.js';`
- `import { CustomerBookingsController } from './customer-bookings.controller.js';`
- `import { CustomerProfileController } from './customer-profile.controller.js';`
- `import { CustomerProfileService } from './customer-profile.service.js';`
- `import { DatabaseProvider } from '../database/database.provider.js';`
- `import { Module } from '@nestjs/common';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { Module } from '@nestjs/common';

import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClaimBookingController } from './claim-booking.controller.js';
import { ClaimBookingService } from './claim-booking.service.js';
import { CustomerAuditAdapter } from './customer-audit.adapter.js';
import { CustomerBookingService } from './customer-booking.service.js';
import { CustomerBookingsController } from './customer-bookings.controller.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';

export const CUSTOMER_AUDIT_ADAPTER = Symbol('CUSTOMER_AUDIT_ADAPTER');

@Module({
  imports: [AppDatabaseModule, AuthModule],
  controllers: [CustomerProfileController, ClaimBookingController, CustomerBookingsController],
  providers: [
    {
      provide: CUSTOMER_AUDIT_ADAPTER,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): CustomerAuditAdapter =>
        new CustomerAuditAdapter(database.client),
    },
    {
      provide: CustomerProfileService,
      inject: [DatabaseProvider, CUSTOMER_AUDIT_ADAPTER],
      useFactory: (
        database: DatabaseProvider,
        audit: CustomerAuditAdapter,
      ): CustomerProfileService => new CustomerProfileService(database.client, audit),
    },
    {
      provide: ClaimBookingService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): ClaimBookingService =>
        new ClaimBookingService({ database: database.client }),
    },
    {
      provide: CustomerBookingService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): CustomerBookingService =>
        new CustomerBookingService(database.client),
    },
  ],
  exports: [CustomerProfileService, ClaimBookingService, CustomerBookingService],
})
export class CustomerModule {}
```

## `apps/api/src/pricing/availability.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\availability.controller.ts`
- Lines: 11

### Top-level declarations / exports

- `export class AvailabilityController`

### Function / method signatures

- None detected by static scan.

### Database tables / schema references

- `import { AvailabilityService } from './availability.service.js';`
- `import { Body, Controller, Inject, Post, Version } from '@nestjs/common';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `import { AvailabilityService } from './availability.service.js';`
- `import { Body, Controller, Inject, Post, Version } from '@nestjs/common';`

### Routing decorators / endpoint declarations

- `@Controller('availability')`
- `@Post('search') @Version('1') public search(@Body() body: unknown) {`

### Verbatim source

```typescript
import { Body, Controller, Inject, Post, Version } from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';
@Controller('availability')
export class AvailabilityController {
  public constructor(
    @Inject(AvailabilityService) private readonly availability: AvailabilityService,
  ) {}
  @Post('search') @Version('1') public search(@Body() body: unknown) {
    return this.availability.search(body);
  }
}
```

## `apps/api/src/pricing/availability.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\availability.repository.ts`
- Lines: 58

### Top-level declarations / exports

- `export class AvailabilityRepository implements AvailabilityRepositoryPort`
- `type AvailabilityDatabase`

### Function / method signatures

- `if (property === undefined)`
- `public async search(input: AvailabilitySearchRequest)`
- `public constructor(private readonly database: AvailabilityDatabase)`

### Database tables / schema references

- `availableRoomCount: rooms.filter(`
- `const [roomTypes, rooms, blocks] = await Promise.all([`
- `const property = await this.database.query.properties.findFirst({`
- `import type { AvailabilityRepositoryPort } from './availability.service.js';`
- `import type { AvailabilitySearchRequest } from '@room/contracts';`
- `import { type DatabaseClient } from '@room/database';`
- `return roomTypes`
- `this.database.query.roomInventoryBlocks.findMany({`
- `this.database.query.roomTypes.findMany({`
- `this.database.query.rooms.findMany({`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `operators.gt(block.endsAt, new Date(input.checkIn)),`
- `operators.lt(block.startsAt, new Date(input.checkOut)),`

### Money / arithmetic operations

- `import type { AvailabilityRepositoryPort } from './availability.service.js';`
- `import type { AvailabilitySearchRequest } from '@room/contracts';`
- `import { type DatabaseClient } from '@room/database';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { type DatabaseClient } from '@room/database';
import type { AvailabilitySearchRequest } from '@room/contracts';
import type { AvailabilityRepositoryPort } from './availability.service.js';

type AvailabilityDatabase = Pick<DatabaseClient, 'query'>;
export class AvailabilityRepository implements AvailabilityRepositoryPort {
  public constructor(private readonly database: AvailabilityDatabase) {}
  public async search(input: AvailabilitySearchRequest) {
    const property = await this.database.query.properties.findFirst({
      orderBy: (item, operators) => [operators.asc(item.createdAt), operators.asc(item.id)],
    });
    if (property === undefined) return [];
    const [roomTypes, rooms, blocks] = await Promise.all([
      this.database.query.roomTypes.findMany({
        where: (type, operators) =>
          operators.and(
            operators.eq(type.propertyId, property.id),
            operators.eq(type.status, 'ACTIVE'),
          ),
        orderBy: (type, operators) => [operators.asc(type.name), operators.asc(type.id)],
      }),
      this.database.query.rooms.findMany({
        where: (room, operators) =>
          operators.and(
            operators.eq(room.propertyId, property.id),
            operators.eq(room.status, 'ACTIVE'),
          ),
      }),
      this.database.query.roomInventoryBlocks.findMany({
        where: (block, operators) =>
          operators.and(
            operators.eq(block.propertyId, property.id),
            operators.eq(block.status, 'ACTIVE'),
            operators.lt(block.startsAt, new Date(input.checkOut)),
            operators.gt(block.endsAt, new Date(input.checkIn)),
          ),
      }),
    ]);
    const blockedRoomIds = new Set(blocks.map((block) => block.roomId));
    return roomTypes
      .filter(
        (type) =>
          type.maxAdults >= input.adults &&
          type.maxChildren >= input.children &&
          type.maxOccupancy >= input.adults + input.children,
      )
      .map((type) => ({
        roomTypeId: type.id,
        roomTypeName: type.name,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        maxOccupancy: type.maxOccupancy,
        availableRoomCount: rooms.filter(
          (room) => room.roomTypeId === type.id && !blockedRoomIds.has(room.id),
        ).length,
      }));
  }
}
```

## `apps/api/src/pricing/availability.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\availability.service.ts`
- Lines: 26

### Top-level declarations / exports

- `export class AvailabilityService`
- `export interface AvailabilityRepositoryPort`

### Function / method signatures

- `public async search(input: unknown)`
- `public constructor(private readonly repository: AvailabilityRepositoryPort)`
- `search(input: AvailabilitySearchRequest): Promise<`

### Database tables / schema references

- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import {
  availabilitySearchRequestSchema,
  availabilitySearchResponseSchema,
  type AvailabilitySearchRequest,
} from '@room/contracts';

export interface AvailabilityRepositoryPort {
  search(input: AvailabilitySearchRequest): Promise<
    readonly {
      readonly roomTypeId: string;
      readonly roomTypeName: string;
      readonly maxAdults: number;
      readonly maxChildren: number;
      readonly maxOccupancy: number;
      readonly availableRoomCount: number;
    }[]
  >;
}
export class AvailabilityService {
  public constructor(private readonly repository: AvailabilityRepositoryPort) {}
  public async search(input: unknown) {
    return availabilitySearchResponseSchema.parse({
      items: await this.repository.search(availabilitySearchRequestSchema.parse(input)),
    });
  }
}
```

## `apps/api/src/pricing/coupon.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\coupon.repository.ts`
- Lines: 149

### Top-level declarations / exports

- `const REVALIDATION_NOTICE`
- `export class CouponExpiredError extends Error`
- `export class CouponMinimumNotMetError extends Error`
- `export class CouponNotApplicableError extends Error`
- `export class CouponRepository`
- `export function toCouponQuoteSummary(evaluation: ProvisionalCouponEvaluation): CouponQuoteSummary`
- `export interface CouponQuoteContext`
- `export interface CouponQuoteProbe`
- `export interface ProvisionalCouponEvaluation`

### Function / method signatures

- `export function toCouponQuoteSummary(evaluation: ProvisionalCouponEvaluation)`
- `if (!Number.isFinite(now.getTime()))`
- `if (!definition)`
- `if (!definition.appliesToAllRoomTypes)`
- `if (!scoped)`
- `if (definition.validFrom > now || definition.validUntil <= now)`
- `if (gross < BigInt(definition.minimumOrderAmountVnd))`
- `public constructor(private readonly database: Pick<DatabaseClient, 'execute' | 'query'>)`

### Database tables / schema references

- `const definition = await this.database.query.coupons.findFirst({`
- `const nowResult = await this.database.execute(sql\`SELECT CURRENT_TIMESTAMP AS now\`);`
- `const scoped = await this.database.query.couponRoomTypes.findFirst({`
- `if (definition.validFrom > now || definition.validUntil <= now) {`
- `import type { CouponQuoteSummary } from '@room/contracts';`
- `import { calculateDiscount } from '@room/booking/coupon';`
- `import { normalizeCouponCode } from '@room/booking/coupon';`
- `import { sql, type DatabaseClient } from '@room/database';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(String(nowValue));`

### Money / arithmetic operations

- `*`
- `* Coupon repository (provisional, quote-time only).`
- `* Phase 6C forbids quote-time quota reservation: a quote is allowed to load`
- `* Provisional evaluation: no quota consumption, no application row.`
- `* Throws domain errors if the coupon cannot be applied to the given`
- `* a coupon definition, validate it provisionally, and calculate a discount`
- `* are deferred to the booking HOLD transaction.`
- `* hold a quota slot. Per-customer quota and the authoritative reservation`
- `* probe so the API layer can return a Problem Details response.`
- `* snapshot — but it must never insert a booking_coupon_application row or`
- `*/`
- `/**`
- `const gross = BigInt(Math.trunc(probe.grossAmountVnd));`
- `discountAmountVnd: Number(evaluation.discountAmountVnd),`
- `discountAmountVnd: result.discountAmountVnd,`
- `finalAmountVnd: Number(evaluation.finalAmountVnd),`
- `finalAmountVnd: result.finalAmountVnd,`
- `fixedAmountVnd: definition.fixedAmountVnd ?? 0n,`
- `fixedAmountVnd: definition.fixedAmountVnd,`
- `grossAmountVnd: Number(evaluation.grossAmountVnd),`
- `grossAmountVnd: gross,`
- `if (gross < BigInt(definition.minimumOrderAmountVnd)) {`
- `import type { CouponQuoteSummary } from '@room/contracts';`
- `import { calculateDiscount } from '@room/booking/coupon';`
- `import { normalizeCouponCode } from '@room/booking/coupon';`
- `import { sql, type DatabaseClient } from '@room/database';`
- `minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),`
- `readonly discountAmountVnd: bigint;`
- `readonly finalAmountVnd: bigint;`
- `readonly fixedAmountVnd: bigint | null;`
- `readonly grossAmountVnd: bigint;`
- `readonly grossAmountVnd: number;`
- `readonly minimumOrderAmountVnd: bigint;`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
/**
 * Coupon repository (provisional, quote-time only).
 *
 * Phase 6C forbids quote-time quota reservation: a quote is allowed to load
 * a coupon definition, validate it provisionally, and calculate a discount
 * snapshot — but it must never insert a booking_coupon_application row or
 * hold a quota slot. Per-customer quota and the authoritative reservation
 * are deferred to the booking HOLD transaction.
 */
import { sql, type DatabaseClient } from '@room/database';
import { normalizeCouponCode } from '@room/booking/coupon';
import { calculateDiscount } from '@room/booking/coupon';
import type { CouponQuoteSummary } from '@room/contracts';

export interface CouponQuoteContext {
  readonly database: Pick<DatabaseClient, 'execute' | 'query'>;
}

export interface CouponQuoteProbe {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly grossAmountVnd: number;
  readonly couponCode: string;
}

export interface ProvisionalCouponEvaluation {
  readonly couponId: string;
  readonly normalizedCode: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly fixedAmountVnd: bigint | null;
  readonly percentageBasisPoints: number | null;
  readonly maximumDiscountVnd: bigint | null;
  readonly minimumOrderAmountVnd: bigint;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
}

export class CouponNotApplicableError extends Error {
  override readonly name = 'CouponNotApplicableError';
  readonly code = 'COUPON_NOT_APPLICABLE';
}

export class CouponExpiredError extends Error {
  override readonly name = 'CouponExpiredError';
  readonly code = 'COUPON_EXPIRED';
}

export class CouponMinimumNotMetError extends Error {
  override readonly name = 'CouponMinimumNotMetError';
  readonly code = 'COUPON_MINIMUM_NOT_MET';
}

export class CouponRepository {
  public constructor(private readonly database: Pick<DatabaseClient, 'execute' | 'query'>) {}

  /**
   * Provisional evaluation: no quota consumption, no application row.
   * Throws domain errors if the coupon cannot be applied to the given
   * probe so the API layer can return a Problem Details response.
   */
  public async evaluateForQuote(probe: CouponQuoteProbe): Promise<ProvisionalCouponEvaluation> {
    const normalized = normalizeCouponCode(probe.couponCode);
    const nowResult = await this.database.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const nowValue = (nowResult.rows[0] as { now?: unknown } | undefined)?.now;
    const now =
      nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(String(nowValue));
    if (!Number.isFinite(now.getTime())) {
      throw new Error('Database did not return its current timestamp.');
    }

    const definition = await this.database.query.coupons.findFirst({
      where: (row, op) =>
        op.and(
          op.eq(row.propertyId, probe.propertyId),
          op.eq(row.normalizedCode, normalized),
          op.eq(row.status, 'ACTIVE'),
        ),
    });
    if (!definition) {
      throw new CouponNotApplicableError('Coupon is not available for this property');
    }

    if (definition.validFrom > now || definition.validUntil <= now) {
      throw new CouponExpiredError('Coupon is outside its validity window');
    }

    if (!definition.appliesToAllRoomTypes) {
      const scoped = await this.database.query.couponRoomTypes.findFirst({
        where: (row, op) =>
          op.and(op.eq(row.couponId, definition.id), op.eq(row.roomTypeId, probe.roomTypeId)),
      });
      if (!scoped) {
        throw new CouponNotApplicableError('Coupon does not apply to this room type');
      }
    }

    const gross = BigInt(Math.trunc(probe.grossAmountVnd));
    if (gross < BigInt(definition.minimumOrderAmountVnd)) {
      throw new CouponMinimumNotMetError('Gross amount is below the coupon minimum order');
    }

    const shape =
      definition.discountType === 'FIXED'
        ? {
            kind: 'FIXED' as const,
            fixedAmountVnd: definition.fixedAmountVnd ?? 0n,
          }
        : {
            kind: 'PERCENTAGE' as const,
            percentageBasisPoints: definition.percentageBasisPoints ?? 0,
            maximumDiscountVnd: definition.maximumDiscountVnd,
          };

    const result = calculateDiscount({
      shape,
      grossAmountVnd: gross,
      minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),
    });

    return {
      couponId: definition.id,
      normalizedCode: definition.normalizedCode,
      discountType: definition.discountType,
      fixedAmountVnd: definition.fixedAmountVnd,
      percentageBasisPoints: definition.percentageBasisPoints,
      maximumDiscountVnd: definition.maximumDiscountVnd,
      minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),
      grossAmountVnd: gross,
      discountAmountVnd: result.discountAmountVnd,
      finalAmountVnd: result.finalAmountVnd,
    };
  }
}

const REVALIDATION_NOTICE =
  'Coupon discount is provisional; remaining quota and per-customer limit are revalidated when creating the booking HOLD.';

export function toCouponQuoteSummary(evaluation: ProvisionalCouponEvaluation): CouponQuoteSummary {
  return {
    code: evaluation.normalizedCode,
    discountType: evaluation.discountType,
    grossAmountVnd: Number(evaluation.grossAmountVnd),
    discountAmountVnd: Number(evaluation.discountAmountVnd),
    finalAmountVnd: Number(evaluation.finalAmountVnd),
    revalidationNotice: REVALIDATION_NOTICE,
  };
}
```

## `apps/api/src/pricing/pricing-engine.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\pricing-engine.ts`
- Lines: 51

### Top-level declarations / exports

- `export const InvalidPricingIntervalError`
- `export const RULE_VERSION`
- `export function calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown`

### Function / method signatures

- `export function calculatePricing(input: PricingInput, catalog: PricingCatalog)`

### Database tables / schema references

- `} from './selection-rule-matcher.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `* Public API: compute the Phase 7B pricing breakdown for a quote.`
- `* The catalog must reflect the current ADMIN-owned rate-plan configuration.`
- `* \`calculatePricing\` is now a thin wrapper around the pure rule matcher.`
- `*/`
- `/**`
- `} from './selection-rule-matcher.js';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import {
  InvalidPricingIntervalError as MatcherInvalidPricingIntervalError,
  PricingRuleAmbiguousError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
  PricingConfigurationError,
  PricingPriceMissingError,
  PricingExtraPriceMissingError,
  validateActiveRuleSet,
  calculatePricing as calculatePricingDelegate,
  RULE_VERSION_PHASE_7B,
  RULE_VERSION_PHASE_4,
  type PricingInput,
  type PricingCatalog,
  type PricingBreakdown,
  type RatePlanCode,
  type BasePlanCode,
  type PricingRuleVersion,
} from './selection-rule-matcher.js';

export type {
  PricingInput,
  PricingCatalog,
  PricingBreakdown,
  RatePlanCode,
  BasePlanCode,
  PricingRuleVersion,
};

export const RULE_VERSION = RULE_VERSION_PHASE_7B;

export { RULE_VERSION_PHASE_7B, RULE_VERSION_PHASE_4 };

export const InvalidPricingIntervalError = MatcherInvalidPricingIntervalError;
export {
  PricingConfigurationError,
  PricingRuleAmbiguousError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
};
export { PricingPriceMissingError, PricingExtraPriceMissingError };
export { validateActiveRuleSet };

/**
 * Public API: compute the Phase 7B pricing breakdown for a quote.
 * `calculatePricing` is now a thin wrapper around the pure rule matcher.
 * The catalog must reflect the current ADMIN-owned rate-plan configuration.
 */
export function calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown {
  return calculatePricingDelegate(input, catalog);
}
```

## `apps/api/src/pricing/quote.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\quote.controller.ts`
- Lines: 12

### Top-level declarations / exports

- `export class QuoteController`

### Function / method signatures

- `public constructor(@Inject(QuoteService) private readonly quotes: QuoteService)`

### Database tables / schema references

- `@Controller('quotes')`
- `import { Body, Controller, Get, Inject, Param, Post, Version } from '@nestjs/common';`
- `import { QuoteService } from './quote.service.js';`
- `public constructor(@Inject(QuoteService) private readonly quotes: QuoteService) {}`
- `return this.quotes.get(id);`
- `return this.quotes.issue(body);`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `import { Body, Controller, Get, Inject, Param, Post, Version } from '@nestjs/common';`
- `import { QuoteService } from './quote.service.js';`

### Routing decorators / endpoint declarations

- `@Controller('quotes')`
- `@Get(':id') @Version('1') public get(@Param('id') id: string) {`
- `@Post() @Version('1') public issue(@Body() body: unknown) {`

### Verbatim source

```typescript
import { Body, Controller, Get, Inject, Param, Post, Version } from '@nestjs/common';
import { QuoteService } from './quote.service.js';
@Controller('quotes')
export class QuoteController {
  public constructor(@Inject(QuoteService) private readonly quotes: QuoteService) {}
  @Post() @Version('1') public issue(@Body() body: unknown) {
    return this.quotes.issue(body);
  }
  @Get(':id') @Version('1') public get(@Param('id') id: string) {
    return this.quotes.get(id);
  }
}
```

## `apps/api/src/pricing/quote.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\quote.repository.ts`
- Lines: 162

### Top-level declarations / exports

- `export class QuoteRepository implements QuoteRepositoryPort`
- `function databaseTimestamp(result:`
- `type Database`

### Function / method signatures

- `Number(price.amountVnd)`
- `function databaseTimestamp(result: { readonly rows: readonly unknown[] })`
- `if (!Number.isFinite(timestamp.getTime()))`
- `if (!property || !roomType)`
- `if (!row)`
- `if (!source) throw new Error('Quote room type disappeared.')`
- `public async catalogFor(input: CreateQuoteRequest)`
- `public async get(id: string)`
- `public constructor(private readonly database: Database)`

### Database tables / schema references

- `? await this.database.query.roomTypes.findFirst({`
- `await this.database.insert(quotes).values({`
- `const [tier, plans, prices, rooms, blocks] = await Promise.all([`
- `const current = await this.database.execute(sql\`SELECT CURRENT_TIMESTAMP AS now\`);`
- `const property = await this.database.query.properties.findFirst();`
- `const row = await this.database.query.quotes.findFirst({`
- `import type { CreateQuoteRequest } from '@room/contracts';`
- `import type { PricingCatalog, PricingBreakdown } from './pricing-engine.js';`
- `import type { ProvisionalCouponEvaluation } from './coupon.repository.js';`
- `import type { QuoteRepositoryPort } from './quote.service.js';`
- `import { quotes, sql, type DatabaseClient } from '@room/database';`
- `import { randomUUID } from 'node:crypto';`
- `import { toCouponQuoteSummary } from './coupon.repository.js';`
- `rooms.some((room) => !blocks.some((block) => block.roomId === room.id)),`
- `this.database.query.priceTiers.findFirst({`
- `this.database.query.ratePlanPrices.findMany({`
- `this.database.query.ratePlans.findMany({`
- `this.database.query.roomInventoryBlocks.findMany({`
- `this.database.query.rooms.findMany({`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `checkIn: new Date(input.checkIn),`
- `checkOut: new Date(input.checkOut),`
- `const expiresAt = new Date(now.getTime() + 900_000);`
- `const timestamp = value instanceof Date ? value : new Date(String(value));`
- `expiresAt: expiresAt.toISOString(),`
- `op.gt(row.endsAt, new Date(input.checkIn)),`
- `op.lt(row.startsAt, new Date(input.checkOut)),`

### Money / arithmetic operations

- `.filter((price) => price.ratePlanId === plan.id)`
- `.map((price) => [`
- `Number(price.amountVnd),`
- `baseAmountVnd: BigInt(pricing.baseAmountVnd),`
- `const [tier, plans, prices, rooms, blocks] = await Promise.all([`
- `coupon.fixedAmountVnd === null ? null : coupon.fixedAmountVnd.toString(),`
- `discountAmountVnd: coupon.discountAmountVnd.toString(),`
- `extraAmountVnd: BigInt(pricing.extraAmountVnd),`
- `finalAmountVnd: coupon.finalAmountVnd.toString(),`
- `fixedAmountVnd:`
- `grossAmountVnd: coupon.grossAmountVnd.toString(),`
- `import type { CreateQuoteRequest } from '@room/contracts';`
- `import type { PricingCatalog, PricingBreakdown } from './pricing-engine.js';`
- `import type { ProvisionalCouponEvaluation } from './coupon.repository.js';`
- `import type { QuoteRepositoryPort } from './quote.service.js';`
- `import { quotes, sql, type DatabaseClient } from '@room/database';`
- `import { toCouponQuoteSummary } from './coupon.repository.js';`
- `minimumOrderAmountVnd: coupon.minimumOrderAmountVnd.toString(),`
- `price.priceTierId === roomType.priceTierId && tier ? tier.code : price.priceTierId,`
- `priceTierCode: tier?.code ?? '',`
- `prices`
- `prices: Object.fromEntries(`
- `this.database.query.priceTiers.findFirst({`
- `totalAmountVnd: BigInt(pricing.totalAmountVnd),`
- `where: (row, op) => op.eq(row.id, roomType.priceTierId),`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { randomUUID } from 'node:crypto';
import { quotes, sql, type DatabaseClient } from '@room/database';
import type { CreateQuoteRequest } from '@room/contracts';
import type { PricingCatalog, PricingBreakdown } from './pricing-engine.js';
import type { QuoteRepositoryPort } from './quote.service.js';
import type { ProvisionalCouponEvaluation } from './coupon.repository.js';
import { toCouponQuoteSummary } from './coupon.repository.js';
type Database = Pick<DatabaseClient, 'execute' | 'query' | 'insert'>;
function databaseTimestamp(result: { readonly rows: readonly unknown[] }): Date {
  const value = (result.rows[0] as { now?: unknown } | undefined)?.now;
  const timestamp = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error('Database did not return its current timestamp.');
  }
  return timestamp;
}
export class QuoteRepository implements QuoteRepositoryPort {
  public constructor(private readonly database: Database) {}
  public async catalogFor(input: CreateQuoteRequest) {
    const property = await this.database.query.properties.findFirst();
    const roomType = property
      ? await this.database.query.roomTypes.findFirst({
          where: (row, op) =>
            op.and(
              op.eq(row.id, input.roomTypeId),
              op.eq(row.propertyId, property.id),
              op.eq(row.status, 'ACTIVE'),
            ),
        })
      : undefined;
    if (!property || !roomType) return undefined;
    const [tier, plans, prices, rooms, blocks] = await Promise.all([
      this.database.query.priceTiers.findFirst({
        where: (row, op) => op.eq(row.id, roomType.priceTierId),
      }),
      this.database.query.ratePlans.findMany({
        where: (row, op) => op.eq(row.propertyId, property.id),
      }),
      this.database.query.ratePlanPrices.findMany({
        where: (row, op) => op.eq(row.propertyId, property.id),
      }),
      this.database.query.rooms.findMany({
        where: (row, op) =>
          op.and(
            op.eq(row.propertyId, property.id),
            op.eq(row.roomTypeId, input.roomTypeId),
            op.eq(row.status, 'ACTIVE'),
          ),
      }),
      this.database.query.roomInventoryBlocks.findMany({
        where: (row, op) =>
          op.and(
            op.eq(row.propertyId, property.id),
            op.eq(row.status, 'ACTIVE'),
            op.lt(row.startsAt, new Date(input.checkOut)),
            op.gt(row.endsAt, new Date(input.checkIn)),
          ),
      }),
    ]);
    const catalog: PricingCatalog = Object.fromEntries(
      plans.map((plan) => [
        plan.code,
        {
          status: plan.status,
          isBasePlan: plan.isBasePlan,
          includedDurationMinutes: plan.includedDurationMinutes,
          priority: plan.priority,
          minCheckInMinuteInclusive: plan.minCheckInMinuteInclusive,
          maxCheckInMinuteExclusive: plan.maxCheckInMinuteExclusive,
          minDurationMinutesInclusive: plan.minDurationMinutesInclusive,
          maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive,
          prices: Object.fromEntries(
            prices
              .filter((price) => price.ratePlanId === plan.id)
              .map((price) => [
                price.priceTierId === roomType.priceTierId && tier ? tier.code : price.priceTierId,
                Number(price.amountVnd),
              ]),
          ),
        },
      ]),
    );
    return {
      available:
        roomType.maxAdults >= input.adults &&
        roomType.maxChildren >= input.children &&
        roomType.maxOccupancy >= input.adults + input.children &&
        rooms.some((room) => !blocks.some((block) => block.roomId === room.id)),
      priceTierCode: tier?.code ?? '',
      propertyTimezone: property.timezone,
      catalog,
      propertyId: property.id,
      roomTypeName: roomType.name,
    };
  }
  public async issue(
    input: CreateQuoteRequest,
    pricing: PricingBreakdown,
    coupon: ProvisionalCouponEvaluation | undefined,
  ): Promise<unknown> {
    const source = await this.catalogFor(input);
    if (!source) throw new Error('Quote room type disappeared.');
    const current = await this.database.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const now = databaseTimestamp(current);
    const expiresAt = new Date(now.getTime() + 900_000);
    const snapshot: Record<string, unknown> = {
      id: randomUUID(),
      roomTypeId: input.roomTypeId,
      roomTypeName: source.roomTypeName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      expiresAt: expiresAt.toISOString(),
      pricing,
      ...(coupon ? { coupon: toCouponQuoteSummary(coupon) } : {}),
    };
    await this.database.insert(quotes).values({
      id: snapshot.id as string,
      propertyId: source.propertyId,
      roomTypeId: input.roomTypeId,
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      adults: input.adults,
      children: input.children,
      baseAmountVnd: BigInt(pricing.baseAmountVnd),
      extraAmountVnd: BigInt(pricing.extraAmountVnd),
      totalAmountVnd: BigInt(pricing.totalAmountVnd),
      pricingSnapshot: snapshot,
      expiresAt,
      ...(coupon
        ? {
            couponId: coupon.couponId,
            couponSnapshot: {
              couponId: coupon.couponId,
              normalizedCode: coupon.normalizedCode,
              discountType: coupon.discountType,
              fixedAmountVnd:
                coupon.fixedAmountVnd === null ? null : coupon.fixedAmountVnd.toString(),
              percentageBasisPoints: coupon.percentageBasisPoints,
              maximumDiscountVnd:
                coupon.maximumDiscountVnd === null ? null : coupon.maximumDiscountVnd.toString(),
              minimumOrderAmountVnd: coupon.minimumOrderAmountVnd.toString(),
              grossAmountVnd: coupon.grossAmountVnd.toString(),
              discountAmountVnd: coupon.discountAmountVnd.toString(),
              finalAmountVnd: coupon.finalAmountVnd.toString(),
            },
          }
        : {}),
    });
    return snapshot;
  }
  public async get(id: string) {
    const row = await this.database.query.quotes.findFirst({
      where: (item, op) => op.eq(item.id, id),
    });
    if (!row) return undefined;
    const current = await this.database.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const now = databaseTimestamp(current);
    return { snapshot: row.pricingSnapshot, expired: row.expiresAt <= now };
  }
}
```

## `apps/api/src/pricing/quote.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\quote.service.ts`
- Lines: 127

### Top-level declarations / exports

- `export class CouponExpiredError extends Error`
- `export class CouponInvalidInputError extends Error`
- `export class CouponMinimumNotMetError extends Error`
- `export class CouponNotApplicableError extends Error`
- `export class QuoteExpiredError extends Error`
- `export class QuoteNotFoundError extends Error`
- `export class QuotePricingConfigurationError extends Error`
- `export class QuoteService`
- `export class QuoteUnavailableError extends Error`
- `export interface QuoteRepositoryPort`
- `export interface QuoteServiceOptions`

### Function / method signatures

- `catalogFor(input: CreateQuoteRequest): Promise<`
- `get(id: string): Promise<`
- `if (error instanceof Error && error.name === 'CouponExpiredError')`
- `if (error instanceof Error && error.name === 'CouponInvalidInputError')`
- `if (error instanceof Error && error.name === 'CouponMinimumNotMetError')`
- `if (error instanceof Error && error.name === 'CouponNotApplicableError')`
- `if (error instanceof PricingConfigurationError) throw new QuotePricingConfigurationError()`
- `if (found === undefined) throw new QuoteNotFoundError()`
- `if (found.expired) throw new QuoteExpiredError()`
- `if (request.couponCode !== undefined && this.options.couponRepository !== undefined)`
- `if (source === undefined || !source.available) throw new QuoteUnavailableError()`
- `public async get(id: string)`
- `public async issue(input: unknown)`

### Database tables / schema references

- `import { CouponRepository, type ProvisionalCouponEvaluation } from './coupon.repository.js';`
- `import { createQuoteRequestSchema, quoteSchema, type CreateQuoteRequest } from '@room/contracts';`
- `} from './pricing-engine.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `).totalAmountVnd,`
- `grossAmountVnd: Math.trunc(`
- `import { CouponRepository, type ProvisionalCouponEvaluation } from './coupon.repository.js';`
- `import { createQuoteRequestSchema, quoteSchema, type CreateQuoteRequest } from '@room/contracts';`
- `priceTierCode: source.priceTierCode,`
- `readonly priceTierCode: string;`
- `} from './pricing-engine.js';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { createQuoteRequestSchema, quoteSchema, type CreateQuoteRequest } from '@room/contracts';
import {
  calculatePricing,
  PricingConfigurationError,
  type PricingCatalog,
} from './pricing-engine.js';
import { CouponRepository, type ProvisionalCouponEvaluation } from './coupon.repository.js';

export class QuoteUnavailableError extends Error {
  public readonly code = 'AVAILABILITY_UNAVAILABLE';
}
export class QuoteNotFoundError extends Error {
  public readonly code = 'QUOTE_NOT_FOUND';
}
export class QuoteExpiredError extends Error {
  public readonly code = 'QUOTE_EXPIRED';
}
export class QuotePricingConfigurationError extends Error {
  public readonly code = 'PRICING_CONFIGURATION_UNAVAILABLE';
}

export class CouponNotApplicableError extends Error {
  public readonly code = 'COUPON_NOT_APPLICABLE';
}

export class CouponExpiredError extends Error {
  public readonly code = 'COUPON_EXPIRED';
}

export class CouponMinimumNotMetError extends Error {
  public readonly code = 'COUPON_MINIMUM_NOT_MET';
}

export class CouponInvalidInputError extends Error {
  public readonly code = 'COUPON_INVALID_INPUT';
}
export interface QuoteRepositoryPort {
  issue(
    input: CreateQuoteRequest,
    pricing: ReturnType<typeof calculatePricing>,
    coupon: ProvisionalCouponEvaluation | undefined,
  ): Promise<unknown>;
  get(id: string): Promise<{ readonly snapshot: unknown; readonly expired: boolean } | undefined>;
  catalogFor(input: CreateQuoteRequest): Promise<
    | {
        readonly available: boolean;
        readonly priceTierCode: string;
        readonly propertyTimezone: string;
        readonly catalog: PricingCatalog;
        readonly propertyId: string;
        readonly roomTypeName: string;
      }
    | undefined
  >;
}

export interface QuoteServiceOptions {
  readonly couponRepository?: CouponRepository;
}
export class QuoteService {
  public constructor(
    private readonly repository: QuoteRepositoryPort,
    private readonly options: QuoteServiceOptions = {},
  ) {}
  public async issue(input: unknown) {
    const request = createQuoteRequestSchema.parse(input);
    const source = await this.repository.catalogFor(request);
    if (source === undefined || !source.available) throw new QuoteUnavailableError();
    try {
      let provisionalEvaluation: ProvisionalCouponEvaluation | undefined;
      if (request.couponCode !== undefined && this.options.couponRepository !== undefined) {
        provisionalEvaluation = await this.options.couponRepository.evaluateForQuote({
          propertyId: source.propertyId,
          roomTypeId: request.roomTypeId,
          grossAmountVnd: Math.trunc(
            calculatePricing(
              {
                checkIn: request.checkIn,
                checkOut: request.checkOut,
                priceTierCode: source.priceTierCode,
                timezone: source.propertyTimezone,
              },
              source.catalog,
            ).totalAmountVnd,
          ),
          couponCode: request.couponCode,
        });
      }
      return quoteSchema.parse(
        await this.repository.issue(
          request,
          calculatePricing(
            {
              checkIn: request.checkIn,
              checkOut: request.checkOut,
              priceTierCode: source.priceTierCode,
              timezone: source.propertyTimezone,
            },
            source.catalog,
          ),
          provisionalEvaluation,
        ),
      );
    } catch (error) {
      if (error instanceof PricingConfigurationError) throw new QuotePricingConfigurationError();
      if (error instanceof Error && error.name === 'CouponInvalidInputError') {
        throw new CouponInvalidInputError();
      }
      if (error instanceof Error && error.name === 'CouponExpiredError') {
        throw new CouponExpiredError();
      }
      if (error instanceof Error && error.name === 'CouponNotApplicableError') {
        throw new CouponNotApplicableError();
      }
      if (error instanceof Error && error.name === 'CouponMinimumNotMetError') {
        throw new CouponMinimumNotMetError();
      }
      throw error;
    }
  }
  public async get(id: string) {
    const found = await this.repository.get(id);
    if (found === undefined) throw new QuoteNotFoundError();
    if (found.expired) throw new QuoteExpiredError();
    return quoteSchema.parse(found.snapshot);
  }
}
```

## `apps/api/src/pricing/rate-plan.controller.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\rate-plan.controller.ts`
- Lines: 74

### Top-level declarations / exports

- `export class RatePlanController`

### Function / method signatures

- `public constructor(@Inject(RatePlanService) private readonly ratePlans: RatePlanService)`
- `public inactivate(@Req() request: { actor: ActorContext }, @Param('id') id: string)`

### Database tables / schema references

- `import type { ActorContext } from '../auth/actor-context.js';`
- `import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';`
- `import { RatePlanService } from './rate-plan.service.js';`
- `import { RequirePermissions } from '../auth/permissions.decorator.js';`
- `public constructor(@Inject(RatePlanService) private readonly ratePlans: RatePlanService) {}`
- `return this.ratePlans.activate(request.actor, id, body);`
- `return this.ratePlans.inactivate(request.actor, id);`
- `return this.ratePlans.list();`
- `return this.ratePlans.updatePrice(request.actor, id, priceTierId, body);`
- `return this.ratePlans.updateSelectionRule(request.actor, id, body);`
- `} from '@nestjs/common';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `@Controller('admin/rate-plans')`
- `@Param('priceTierId') priceTierId: string,`
- `@Patch(':id/prices/:priceTierId')`
- `@Patch(':id/selection-rule')`
- `@Post(':id/activate')`
- `@Post(':id/inactivate')`
- `@Put(':id/prices/:priceTierId')`
- `import type { ActorContext } from '../auth/actor-context.js';`
- `import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';`
- `import { RatePlanService } from './rate-plan.service.js';`
- `import { RequirePermissions } from '../auth/permissions.decorator.js';`
- `return this.ratePlans.updatePrice(request.actor, id, priceTierId, body);`
- `} from '@nestjs/common';`

### Routing decorators / endpoint declarations

- `@Body() body: unknown,`
- `@Controller('admin/rate-plans')`
- `@Get() @Version('1') @RequirePermissions('pricing.rate_plan.read') public list() {`
- `@Param('id') id: string,`
- `@Param('priceTierId') priceTierId: string,`
- `@Patch(':id/prices/:priceTierId')`
- `@Patch(':id/selection-rule')`
- `@Post(':id/activate')`
- `@Post(':id/inactivate')`
- `@Put(':id/prices/:priceTierId')`
- `@Req() request: { actor: ActorContext },`
- `@RequirePermissions('pricing.rate_plan.manage')`
- `@Version('1')`

### Verbatim source

```typescript
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { RatePlanService } from './rate-plan.service.js';

@Controller('admin/rate-plans')
@UseGuards(AdminPermissionGuard)
export class RatePlanController {
  public constructor(@Inject(RatePlanService) private readonly ratePlans: RatePlanService) {}
  @Get() @Version('1') @RequirePermissions('pricing.rate_plan.read') public list() {
    return this.ratePlans.list();
  }
  @Patch(':id/prices/:priceTierId')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public updatePrice(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Param('priceTierId') priceTierId: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.updatePrice(request.actor, id, priceTierId, body);
  }
  @Patch(':id/selection-rule')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public updateSelectionRule(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.updateSelectionRule(request.actor, id, body);
  }
  @Put(':id/prices/:priceTierId')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public replacePrice(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Param('priceTierId') priceTierId: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.updatePrice(request.actor, id, priceTierId, body);
  }
  @Post(':id/activate')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public activate(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.activate(request.actor, id, body);
  }
  @Post(':id/inactivate')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public inactivate(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.ratePlans.inactivate(request.actor, id);
  }
}
```

## `apps/api/src/pricing/rate-plan.repository.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\rate-plan.repository.ts`
- Lines: 280

### Top-level declarations / exports

- `export class RatePlanRepository implements RatePlanRepositoryPort`
- `function databaseFor(transaction: unknown, fallback: RatePlanDatabase): TransactionalPool`
- `function rowToRecord(row: RatePlanRow, priceRows: readonly RatePlanPriceRow[]): RatePlanRecord`
- `function storedRowToRecord(`
- `type RatePlanDatabase`
- `type RatePlanPriceRow`
- `type RatePlanRow`
- `type StoredRatePlan`
- `type StoredRatePlanPrice`
- `type TransactionalPool`

### Function / method signatures

- `eq(ratePlanPrices.priceTierId, priceTierId)`
- `eq(ratePlanPrices.propertyId, propertyId)`
- `eq(ratePlanPrices.ratePlanId, planId)`
- `for (const price of prices)`
- `function databaseFor(transaction: unknown, fallback: RatePlanDatabase)`
- `function rowToRecord(row: RatePlanRow, priceRows: readonly RatePlanPriceRow[])`
- `if (patch.includedDurationMinutes !== undefined)`
- `if (patch.maxCheckInMinuteExclusive !== undefined)`
- `if (patch.maxDurationMinutesInclusive !== undefined)`
- `if (patch.minCheckInMinuteInclusive !== undefined)`
- `if (patch.minDurationMinutesInclusive !== undefined)`
- `if (patch.priority !== undefined)`
- `if (plan === undefined || tier === undefined) throw new Error('RATE_PLAN_PRICE_NOT_FOUND')`
- `if (plan === undefined)`
- `if (tierIds.length === 0)`
- `if (updated !== undefined)`
- `if (updated === undefined)`
- `public async getCurrentProperty(transaction?: unknown): Promise<`
- `public async listRatePlans(propertyId: string): Promise<readonly RatePlanRecord[]>`
- `public async requiredActiveTierIds(propertyId: string): Promise<readonly string[]>`
- `public constructor(private readonly database: RatePlanDatabase)`

### Database tables / schema references

- `.returning({ id: ratePlanPrices.id });`
- `.update(ratePlanPrices)`
- `.update(ratePlans)`
- `.where(and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.id, planId)))`
- `// Acquire the row-level lock with FOR UPDATE so concurrent ADMIN`
- `FROM rate_plans`
- `await tx.insert(ratePlanPrices).values({`
- `const activeTypes = await this.database.query.roomTypes.findMany({`
- `const plan = await tx.query.ratePlans.findFirst({`
- `const plans = await this.database.query.ratePlans.findMany({`
- `const prices = await this.database.query.ratePlanPrices.findMany({`
- `const prices = await tx.query.ratePlanPrices.findMany({`
- `const tier = await tx.query.priceTiers.findFirst({`
- `eq(ratePlanPrices.priceTierId, priceTierId),`
- `eq(ratePlanPrices.propertyId, propertyId),`
- `eq(ratePlanPrices.ratePlanId, planId),`
- `import { and, eq, ratePlanPrices, ratePlans, sql, type DatabaseClient } from '@room/database';`
- `return databaseFor(transaction, this.database).query.properties.findFirst({`
- `sql\`SELECT id, property_id, code, name, status,`
- `type StoredRatePlan = typeof ratePlans.$inferSelect;`
- `type StoredRatePlanPrice = typeof ratePlanPrices.$inferSelect;`
- `} from './rate-plan.service.js';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `.set({ amountVnd: BigInt(amountVnd), updatedAt: new Date() })`
- `.set({ status, updatedAt: new Date() })`
- `const updates: Record<string, unknown> = { updatedAt: new Date() };`

### Money / arithmetic operations

- `.set({ amountVnd: BigInt(amountVnd), updatedAt: new Date() })`
- `// Acquire the row-level lock with FOR UPDATE so concurrent ADMIN`
- `// COMMIT/ROLLBACK.`
- `// the same connection as the transaction so the lock is held until`
- `// updates serialize through this transaction. The query is bound to`
- `amountVnd: BigInt(amountVnd),`
- `amountVnd: number,`
- `amountVnd: price.amountVnd,`
- `amountVnd: price.amount_vnd,`
- `const list = grouped.get(price.ratePlanId) ?? [];`
- `const priced = new Set(prices.map((price) => price.priceTierId));`
- `const prices = await this.database.query.ratePlanPrices.findMany({`
- `const prices = await tx.query.ratePlanPrices.findMany({`
- `const tier = await tx.query.priceTiers.findFirst({`
- `eq(ratePlanPrices.priceTierId, priceTierId),`
- `for (const price of prices) {`
- `function rowToRecord(row: RatePlanRow, priceRows: readonly RatePlanPriceRow[]): RatePlanRecord {`
- `grouped.set(price.ratePlanId, list);`
- `import { and, eq, ratePlanPrices, ratePlans, sql, type DatabaseClient } from '@room/database';`
- `list.push({ price_tier_id: price.priceTierId, amount_vnd: price.amountVnd });`
- `operators.eq(price.propertyId, propertyId),`
- `operators.eq(price.ratePlanId, planId),`
- `operators.eq(priceTier.id, priceTierId),`
- `operators.eq(priceTier.propertyId, propertyId),`
- `priceRows: readonly StoredRatePlanPrice[],`
- `priceTierId,`
- `priceTierId: price.priceTierId,`
- `priceTierId: price.price_tier_id,`
- `priceTierId: string,`
- `prices.filter((price) => price.ratePlanId === plan.id),`
- `prices: priceRows.map((price) => ({`
- `readonly price_tier_id: string;`
- `return [...new Set(activeTypes.map((roomType) => roomType.priceTierId))];`
- `return storedRowToRecord(plan, prices);`
- `return storedRowToRecord(updated, prices);`
- `return tierIds.filter((tierId) => !priced.has(tierId));`
- `where: (price, operators) =>`
- `where: (price, operators) => operators.eq(price.propertyId, propertyId),`
- `where: (price, operators) => operators.eq(price.ratePlanId, plan.id),`
- `where: (priceTier, operators) =>`
- `} from './rate-plan.service.js';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import { and, eq, ratePlanPrices, ratePlans, sql, type DatabaseClient } from '@room/database';

import type {
  RatePlanRecord,
  RatePlanRepositoryPort,
  SelectionRulePatch,
} from './rate-plan.service.js';

type RatePlanDatabase = Pick<DatabaseClient, 'execute' | 'insert' | 'query' | 'update'>;
type TransactionalPool = Pick<DatabaseClient, 'execute' | 'insert' | 'query' | 'update'> & {
  transaction?: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

type RatePlanRow = {
  readonly id: string;
  readonly property_id: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly included_duration_minutes: number;
  readonly priority: number;
  readonly is_base_plan: boolean;
  readonly min_check_in_minute_inclusive: number | null;
  readonly max_check_in_minute_exclusive: number | null;
  readonly min_duration_minutes_inclusive: number | null;
  readonly max_duration_minutes_inclusive: number | null;
  readonly created_at: Date;
  readonly updated_at: Date;
};

type RatePlanPriceRow = {
  readonly price_tier_id: string;
  readonly amount_vnd: bigint | null;
};

type StoredRatePlan = typeof ratePlans.$inferSelect;
type StoredRatePlanPrice = typeof ratePlanPrices.$inferSelect;

function databaseFor(transaction: unknown, fallback: RatePlanDatabase): TransactionalPool {
  return transaction === undefined ? fallback : (transaction as TransactionalPool);
}

function rowToRecord(row: RatePlanRow, priceRows: readonly RatePlanPriceRow[]): RatePlanRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    code: row.code as RatePlanRecord['code'],
    name: row.name,
    status: row.status,
    includedDurationMinutes: row.included_duration_minutes,
    priority: row.priority,
    isBasePlan: row.is_base_plan,
    minCheckInMinuteInclusive: row.min_check_in_minute_inclusive,
    maxCheckInMinuteExclusive: row.max_check_in_minute_exclusive,
    minDurationMinutesInclusive: row.min_duration_minutes_inclusive,
    maxDurationMinutesInclusive: row.max_duration_minutes_inclusive,
    prices: priceRows.map((price) => ({
      priceTierId: price.price_tier_id,
      amountVnd: price.amount_vnd,
    })),
  };
}

function storedRowToRecord(
  row: StoredRatePlan,
  priceRows: readonly StoredRatePlanPrice[],
): RatePlanRecord {
  return {
    id: row.id,
    propertyId: row.propertyId,
    code: row.code as RatePlanRecord['code'],
    name: row.name,
    status: row.status,
    includedDurationMinutes: row.includedDurationMinutes,
    priority: row.priority,
    isBasePlan: row.isBasePlan,
    minCheckInMinuteInclusive: row.minCheckInMinuteInclusive,
    maxCheckInMinuteExclusive: row.maxCheckInMinuteExclusive,
    minDurationMinutesInclusive: row.minDurationMinutesInclusive,
    maxDurationMinutesInclusive: row.maxDurationMinutesInclusive,
    prices: priceRows.map((price) => ({
      priceTierId: price.priceTierId,
      amountVnd: price.amountVnd,
    })),
  };
}

export class RatePlanRepository implements RatePlanRepositoryPort {
  public constructor(private readonly database: RatePlanDatabase) {}

  public async getCurrentProperty(transaction?: unknown): Promise<{ id: string } | undefined> {
    return databaseFor(transaction, this.database).query.properties.findFirst({
      orderBy: (property, operators) => [
        operators.asc(property.createdAt),
        operators.asc(property.id),
      ],
    });
  }

  public async lockActiveRuleSet(
    transaction: unknown,
    propertyId: string,
  ): Promise<readonly RatePlanRecord[]> {
    const tx = databaseFor(transaction, this.database);
    // Acquire the row-level lock with FOR UPDATE so concurrent ADMIN
    // updates serialize through this transaction. The query is bound to
    // the same connection as the transaction so the lock is held until
    // COMMIT/ROLLBACK.
    const rawRows = await tx.execute(
      sql`SELECT id, property_id, code, name, status,
                 included_duration_minutes, priority, is_base_plan,
                 min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                 min_duration_minutes_inclusive, max_duration_minutes_inclusive,
                 created_at, updated_at
            FROM rate_plans
           WHERE property_id = ${propertyId}
           ORDER BY priority ASC, code ASC
             FOR UPDATE`,
    );
    const rows = (rawRows as unknown as { rows: readonly RatePlanRow[] }).rows;
    const prices = await tx.query.ratePlanPrices.findMany({
      where: (price, operators) => operators.eq(price.propertyId, propertyId),
    });
    const grouped = new Map<string, RatePlanPriceRow[]>();
    for (const price of prices) {
      const list = grouped.get(price.ratePlanId) ?? [];
      list.push({ price_tier_id: price.priceTierId, amount_vnd: price.amountVnd });
      grouped.set(price.ratePlanId, list);
    }
    return rows.map((row) => rowToRecord(row, grouped.get(row.id) ?? []));
  }

  public async listRatePlans(propertyId: string): Promise<readonly RatePlanRecord[]> {
    const plans = await this.database.query.ratePlans.findMany({
      where: (plan, operators) => operators.eq(plan.propertyId, propertyId),
      orderBy: (plan, operators) => [operators.asc(plan.priority), operators.asc(plan.code)],
    });
    const prices = await this.database.query.ratePlanPrices.findMany({
      where: (price, operators) => operators.eq(price.propertyId, propertyId),
    });
    return plans.map((plan) =>
      storedRowToRecord(
        plan,
        prices.filter((price) => price.ratePlanId === plan.id),
      ),
    );
  }

  public async updatePrice(
    transaction: unknown,
    propertyId: string,
    planId: string,
    priceTierId: string,
    amountVnd: number,
  ): Promise<void> {
    const tx = databaseFor(transaction, this.database);
    const [updated] = await tx
      .update(ratePlanPrices)
      .set({ amountVnd: BigInt(amountVnd), updatedAt: new Date() })
      .where(
        and(
          eq(ratePlanPrices.propertyId, propertyId),
          eq(ratePlanPrices.ratePlanId, planId),
          eq(ratePlanPrices.priceTierId, priceTierId),
        ),
      )
      .returning({ id: ratePlanPrices.id });
    if (updated !== undefined) return;
    const plan = await tx.query.ratePlans.findFirst({
      where: (ratePlan, operators) =>
        operators.and(
          operators.eq(ratePlan.id, planId),
          operators.eq(ratePlan.propertyId, propertyId),
        ),
    });
    const tier = await tx.query.priceTiers.findFirst({
      where: (priceTier, operators) =>
        operators.and(
          operators.eq(priceTier.id, priceTierId),
          operators.eq(priceTier.propertyId, propertyId),
        ),
    });
    if (plan === undefined || tier === undefined) throw new Error('RATE_PLAN_PRICE_NOT_FOUND');
    await tx.insert(ratePlanPrices).values({
      propertyId,
      ratePlanId: planId,
      priceTierId,
      amountVnd: BigInt(amountVnd),
    });
  }

  public async updateSelectionRule(
    transaction: unknown,
    propertyId: string,
    planId: string,
    patch: SelectionRulePatch,
  ): Promise<RatePlanRecord | undefined> {
    const tx = databaseFor(transaction, this.database);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.includedDurationMinutes !== undefined) {
      updates['includedDurationMinutes'] = patch.includedDurationMinutes;
    }
    if (patch.priority !== undefined) {
      updates['priority'] = patch.priority;
    }
    if (patch.minCheckInMinuteInclusive !== undefined) {
      updates['minCheckInMinuteInclusive'] = patch.minCheckInMinuteInclusive;
    }
    if (patch.maxCheckInMinuteExclusive !== undefined) {
      updates['maxCheckInMinuteExclusive'] = patch.maxCheckInMinuteExclusive;
    }
    if (patch.minDurationMinutesInclusive !== undefined) {
      updates['minDurationMinutesInclusive'] = patch.minDurationMinutesInclusive;
    }
    if (patch.maxDurationMinutesInclusive !== undefined) {
      updates['maxDurationMinutesInclusive'] = patch.maxDurationMinutesInclusive;
    }
    const [updated] = await tx
      .update(ratePlans)
      .set(updates)
      .where(and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.id, planId)))
      .returning();
    if (updated === undefined) return undefined;
    const prices = await tx.query.ratePlanPrices.findMany({
      where: (price, operators) =>
        operators.and(
          operators.eq(price.propertyId, propertyId),
          operators.eq(price.ratePlanId, planId),
        ),
    });
    return storedRowToRecord(updated, prices);
  }

  public async setStatus(
    transaction: unknown,
    propertyId: string,
    planId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<RatePlanRecord | undefined> {
    const tx = databaseFor(transaction, this.database);
    const [plan] = await tx
      .update(ratePlans)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.id, planId)))
      .returning();
    if (plan === undefined) return undefined;
    const prices = await tx.query.ratePlanPrices.findMany({
      where: (price, operators) => operators.eq(price.ratePlanId, plan.id),
    });
    return storedRowToRecord(plan, prices);
  }

  public async requiredActiveTierIds(propertyId: string): Promise<readonly string[]> {
    const activeTypes = await this.database.query.roomTypes.findMany({
      where: (roomType, operators) =>
        operators.and(
          operators.eq(roomType.propertyId, propertyId),
          operators.eq(roomType.status, 'ACTIVE'),
        ),
    });
    return [...new Set(activeTypes.map((roomType) => roomType.priceTierId))];
  }

  public async missingPrices(
    propertyId: string,
    planId: string,
    tierIds: readonly string[],
  ): Promise<readonly string[]> {
    if (tierIds.length === 0) return [];
    const prices = await this.database.query.ratePlanPrices.findMany({
      where: (price, operators) =>
        operators.and(
          operators.eq(price.propertyId, propertyId),
          operators.eq(price.ratePlanId, planId),
        ),
    });
    const priced = new Set(prices.map((price) => price.priceTierId));
    return tierIds.filter((tierId) => !priced.has(tierId));
  }
}
```

## `apps/api/src/pricing/rate-plan.service.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\rate-plan.service.ts`
- Lines: 319

### Top-level declarations / exports

- `export class RatePlanService`
- `export interface RatePlanRecord`
- `export interface RatePlanRepositoryPort`
- `export interface RatePlanTransactionManager`
- `export interface SelectionRulePatch`
- `function buildCatalog(records: readonly RatePlanRecord[]): PricingCatalog`
- `function selectionRulePatchFrom(`
- `function summarisePatch(patch: SelectionRulePatch): Record<string, string | number>`
- `function toContract(record: RatePlanRecord)`
- `function withPrices(`

### Function / method signatures

- `for (const [key, value] of Object.entries(cmdRecord))`
- `for (const [key, value] of Object.entries(patch))`
- `for (const price of record.prices)`
- `for (const record of records)`
- `function buildCatalog(records: readonly RatePlanRecord[])`
- `function summarisePatch(patch: SelectionRulePatch)`
- `function toContract(record: RatePlanRecord)`
- `getCurrentProperty(transaction?: unknown): Promise<`
- `if (error instanceof Error && error.message === 'RATE_PLAN_PRICE_NOT_FOUND')`
- `if (missing.length > 0)`
- `if (missing.length > 0) throw new CatalogConflictError()`
- `if (plan === undefined) throw new CatalogNotFoundError()`
- `if (price.amountVnd !== null) prices[price.priceTierId] = Number(price.amountVnd)`
- `if (property === undefined) throw new CatalogNotFoundError()`
- `if (status === 'ACTIVE')`
- `if (target === undefined) throw new CatalogNotFoundError()`
- `if (tierIds.length === 0)`
- `if (updated === undefined) throw new CatalogNotFoundError()`
- `if (value === undefined || value === null)`
- `if (value === undefined)`
- `listRatePlans(propertyId: string): Promise<readonly RatePlanRecord[]>;`
- `lockActiveRuleSet(transaction: unknown, propertyId: string): Promise<readonly RatePlanRecord[]>;`
- `private async changeStatus(actor: ActorContext, planId: string, status: 'ACTIVE' | 'INACTIVE')`
- `public async activate(actor: ActorContext, planId: string, input: unknown)`
- `public async inactivate(actor: ActorContext, planId: string)`
- `public async list()`
- `public async updateSelectionRule(actor: ActorContext, planId: string, input: unknown)`
- `requiredActiveTierIds(propertyId: string): Promise<readonly string[]>;`
- `validateActiveRuleSet(catalog, { requiredPriceTierCodes: tierIds })`

### Database tables / schema references

- `// The Zod contract differentiates "omitted" from "explicit null" via`
- `const patch = selectionRulePatchFrom(target, command);`
- `function selectionRulePatchFrom(`
- `import type { ActorContext } from '../auth/actor-context.js';`
- `import type { AuditRepositoryPort } from '../catalog/catalog.service.js';`
- `import type { PricingCatalog } from './pricing-engine.js';`
- `import { CatalogConflictError, CatalogNotFoundError } from '../catalog/catalog.errors.js';`
- `import { validateActiveRuleSet } from './selection-rule-matcher.js';`
- `} from '@room/contracts';`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- None detected by static scan.

### Money / arithmetic operations

- `(priceTierId) =>`
- `* Acquire the row-level lock on every rate plan of the given property`
- `* The lock must remain held until COMMIT.`
- `* before reading the tentative active rule set inside a transaction.`
- `*/`
- `/**`
- `// .optional(); here we treat every key in the parsed command as`
- `// The Zod contract differentiates "omitted" from "explicit null" via`
- `// authoritative — undefined ⇒ preserve current value, null ⇒ clear.`
- `\`Selected plan is missing active tier prices: ${missing.join(', ')}\`,`
- `amountVnd: null,`
- `amountVnd: number,`
- `amountVnd: price.amountVnd === null ? null : Number(price.amountVnd),`
- `command.amountVnd,`
- `const prices: Record<string, number> = {};`
- `for (const price of record.prices) {`
- `if (price.amountVnd !== null) prices[price.priceTierId] = Number(price.amountVnd);`
- `import type { ActorContext } from '../auth/actor-context.js';`
- `import type { AuditRepositoryPort } from '../catalog/catalog.service.js';`
- `import type { PricingCatalog } from './pricing-engine.js';`
- `import { CatalogConflictError, CatalogNotFoundError } from '../catalog/catalog.errors.js';`
- `import { validateActiveRuleSet } from './selection-rule-matcher.js';`
- `payload: { priceTierId, amountVnd: command.amountVnd },`
- `priceTierId,`
- `priceTierId: price.priceTierId,`
- `priceTierId: string,`
- `prices,`
- `prices: record.prices.map((price) => ({`
- `prices: tierIds.map(`
- `readonly prices: readonly { readonly priceTierId: string; readonly amountVnd: bigint | null }[];`
- `record.prices.find((price) => price.priceTierId === priceTierId) ?? {`
- `return toContract({ ...updated, prices: updated.prices });`
- `} from '@room/contracts';`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
import {
  ratePlanActivationSchema,
  ratePlanPriceCommandSchema,
  ratePlanSchema,
  ratePlanSelectionRuleCommandSchema,
  type RatePlanSelectionRuleCommand,
} from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import { CatalogConflictError, CatalogNotFoundError } from '../catalog/catalog.errors.js';
import type { AuditRepositoryPort } from '../catalog/catalog.service.js';
import { validateActiveRuleSet } from './selection-rule-matcher.js';
import type { PricingCatalog } from './pricing-engine.js';

export interface RatePlanRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly code:
    | 'THREE_HOUR_COMBO'
    | 'FIVE_HOUR_COMBO'
    | 'LUNCH_COMBO'
    | 'NIGHT_COMBO'
    | 'DAY_COMBO'
    | 'EXTRA_HOUR';
  readonly name: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly includedDurationMinutes: number;
  readonly priority: number;
  readonly isBasePlan: boolean;
  readonly minCheckInMinuteInclusive: number | null;
  readonly maxCheckInMinuteExclusive: number | null;
  readonly minDurationMinutesInclusive: number | null;
  readonly maxDurationMinutesInclusive: number | null;
  readonly prices: readonly { readonly priceTierId: string; readonly amountVnd: bigint | null }[];
}
export interface RatePlanRepositoryPort {
  getCurrentProperty(transaction?: unknown): Promise<{ readonly id: string } | undefined>;
  /**
   * Acquire the row-level lock on every rate plan of the given property
   * before reading the tentative active rule set inside a transaction.
   * The lock must remain held until COMMIT.
   */
  lockActiveRuleSet(transaction: unknown, propertyId: string): Promise<readonly RatePlanRecord[]>;
  listRatePlans(propertyId: string): Promise<readonly RatePlanRecord[]>;
  updatePrice(
    transaction: unknown,
    propertyId: string,
    planId: string,
    priceTierId: string,
    amountVnd: number,
  ): Promise<void>;
  updateSelectionRule(
    transaction: unknown,
    propertyId: string,
    planId: string,
    patch: SelectionRulePatch,
  ): Promise<RatePlanRecord | undefined>;
  setStatus(
    transaction: unknown,
    propertyId: string,
    planId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<RatePlanRecord | undefined>;
  requiredActiveTierIds(propertyId: string): Promise<readonly string[]>;
  missingPrices(
    propertyId: string,
    planId: string,
    tierIds: readonly string[],
  ): Promise<readonly string[]>;
}

export interface SelectionRulePatch {
  readonly includedDurationMinutes?: number;
  readonly priority?: number;
  readonly minCheckInMinuteInclusive?: number | null;
  readonly maxCheckInMinuteExclusive?: number | null;
  readonly minDurationMinutesInclusive?: number | null;
  readonly maxDurationMinutesInclusive?: number | null;
}

export interface RatePlanTransactionManager {
  transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
}
function toContract(record: RatePlanRecord) {
  return ratePlanSchema.parse({
    id: record.id,
    code: record.code,
    name: record.name,
    status: record.status,
    includedDurationMinutes: record.includedDurationMinutes,
    priority: record.priority,
    isBasePlan: record.isBasePlan,
    minCheckInMinuteInclusive: record.minCheckInMinuteInclusive,
    maxCheckInMinuteExclusive: record.maxCheckInMinuteExclusive,
    minDurationMinutesInclusive: record.minDurationMinutesInclusive,
    maxDurationMinutesInclusive: record.maxDurationMinutesInclusive,
    prices: record.prices.map((price) => ({
      priceTierId: price.priceTierId,
      amountVnd: price.amountVnd === null ? null : Number(price.amountVnd),
    })),
  });
}

function buildCatalog(records: readonly RatePlanRecord[]): PricingCatalog {
  const catalog: Record<string, unknown> = {};
  for (const record of records) {
    const prices: Record<string, number> = {};
    for (const price of record.prices) {
      if (price.amountVnd !== null) prices[price.priceTierId] = Number(price.amountVnd);
    }
    catalog[record.code] = {
      status: record.status,
      isBasePlan: record.isBasePlan,
      includedDurationMinutes: record.includedDurationMinutes,
      priority: record.priority,
      minCheckInMinuteInclusive: record.minCheckInMinuteInclusive,
      maxCheckInMinuteExclusive: record.maxCheckInMinuteExclusive,
      minDurationMinutesInclusive: record.minDurationMinutesInclusive,
      maxDurationMinutesInclusive: record.maxDurationMinutesInclusive,
      prices,
    };
  }
  return catalog as PricingCatalog;
}

function withPrices(
  records: readonly RatePlanRecord[],
  tierIds: readonly string[],
): readonly RatePlanRecord[] {
  if (tierIds.length === 0) return records;
  return records.map((record) => ({
    ...record,
    prices: tierIds.map(
      (priceTierId) =>
        record.prices.find((price) => price.priceTierId === priceTierId) ?? {
          priceTierId,
          amountVnd: null,
        },
    ),
  }));
}

function summarisePatch(patch: SelectionRulePatch): Record<string, string | number> {
  const summarised: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      summarised[key] = 'null';
    } else if (typeof value === 'number') {
      summarised[key] = value;
    } else {
      summarised[key] = String(value);
    }
  }
  return summarised;
}

function selectionRulePatchFrom(
  _target: RatePlanRecord,
  command: RatePlanSelectionRuleCommand,
): SelectionRulePatch {
  // The Zod contract differentiates "omitted" from "explicit null" via
  // .optional(); here we treat every key in the parsed command as
  // authoritative — undefined ⇒ preserve current value, null ⇒ clear.
  const patch: Record<string, unknown> = {};
  const cmdRecord = command as Record<string, unknown>;
  for (const [key, value] of Object.entries(cmdRecord)) {
    if (value === undefined) continue;
    patch[key] = value;
  }
  return patch as SelectionRulePatch;
}

export class RatePlanService {
  public constructor(
    private readonly database: RatePlanTransactionManager,
    private readonly repository: RatePlanRepositoryPort,
    private readonly audit: AuditRepositoryPort,
  ) {}
  public async list() {
    const property = await this.repository.getCurrentProperty();
    if (property === undefined) throw new CatalogNotFoundError();
    const tierIds = await this.repository.requiredActiveTierIds(property.id);
    const records = await this.repository.listRatePlans(property.id);
    return {
      items: withPrices(records, tierIds).map((record) => toContract(record)),
    };
  }
  public async updatePrice(
    actor: ActorContext,
    planId: string,
    priceTierId: string,
    input: unknown,
  ) {
    const command = ratePlanPriceCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      try {
        await this.repository.updatePrice(
          transaction,
          property.id,
          planId,
          priceTierId,
          command.amountVnd,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'RATE_PLAN_PRICE_NOT_FOUND')
          throw new CatalogNotFoundError();
        throw error;
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'RATE_PLAN',
        aggregateId: planId,
        eventType: 'RATE_PLAN_PRICE_UPDATED',
        actorId: actor.userId,
        payload: { priceTierId, amountVnd: command.amountVnd },
      });
    });
  }
  public async updateSelectionRule(actor: ActorContext, planId: string, input: unknown) {
    const command = ratePlanSelectionRuleCommandSchema.parse(input) as RatePlanSelectionRuleCommand;
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const locked = await this.repository.lockActiveRuleSet(transaction, property.id);
      const target = locked.find((plan) => plan.id === planId);
      if (target === undefined) throw new CatalogNotFoundError();
      const patch = selectionRulePatchFrom(target, command);
      const updated = await this.repository.updateSelectionRule(
        transaction,
        property.id,
        planId,
        patch,
      );
      if (updated === undefined) throw new CatalogNotFoundError();
      const tentative = await this.repository.lockActiveRuleSet(transaction, property.id);
      const tierIds = await this.repository.requiredActiveTierIds(property.id);
      const catalog = buildCatalog(withPrices(tentative, tierIds));
      try {
        validateActiveRuleSet(catalog, { requiredPriceTierCodes: tierIds });
      } catch (error) {
        throw new CatalogConflictError(
          error instanceof Error ? error.message : 'Pricing rule set is invalid.',
        );
      }
      const missing = await this.repository.missingPrices(property.id, updated.id, tierIds);
      if (missing.length > 0) {
        throw new CatalogConflictError(
          `Selected plan is missing active tier prices: ${missing.join(', ')}`,
        );
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'RATE_PLAN',
        aggregateId: planId,
        eventType: 'RATE_PLAN_SELECTION_RULE_UPDATED',
        actorId: actor.userId,
        payload: summarisePatch(patch),
      });
      return toContract({ ...updated, prices: updated.prices });
    });
  }
  public async activate(actor: ActorContext, planId: string, input: unknown) {
    ratePlanActivationSchema.parse(input);
    return this.changeStatus(actor, planId, 'ACTIVE');
  }
  public async inactivate(actor: ActorContext, planId: string) {
    return this.changeStatus(actor, planId, 'INACTIVE');
  }
  private async changeStatus(actor: ActorContext, planId: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const locked = await this.repository.lockActiveRuleSet(transaction, property.id);
      const target = locked.find((plan) => plan.id === planId);
      if (target === undefined) throw new CatalogNotFoundError();
      const tierIds = await this.repository.requiredActiveTierIds(property.id);
      if (status === 'ACTIVE') {
        const missing = await this.repository.missingPrices(property.id, planId, tierIds);
        if (missing.length > 0) throw new CatalogConflictError();
        const tentative = locked.map((record) =>
          record.id === planId ? { ...record, status: 'ACTIVE' as const } : record,
        );
        const catalog = buildCatalog(withPrices(tentative, tierIds));
        try {
          validateActiveRuleSet(catalog, { requiredPriceTierCodes: tierIds });
        } catch (error) {
          throw new CatalogConflictError(
            error instanceof Error ? error.message : 'Pricing rule set is invalid.',
          );
        }
      } else {
        const tentative = locked
          .filter((record) => record.id !== planId)
          .map((record) => ({ ...record, status: 'ACTIVE' as const }));
        const catalog = buildCatalog(withPrices(tentative, tierIds));
        try {
          validateActiveRuleSet(catalog, { requiredPriceTierCodes: tierIds });
        } catch (error) {
          throw new CatalogConflictError(
            error instanceof Error ? error.message : 'Pricing rule set is invalid.',
          );
        }
      }
      const plan = await this.repository.setStatus(transaction, property.id, planId, status);
      if (plan === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'RATE_PLAN',
        aggregateId: plan.id,
        eventType: status === 'ACTIVE' ? 'RATE_PLAN_ACTIVATED' : 'RATE_PLAN_INACTIVATED',
        actorId: actor.userId,
        payload: { code: plan.code },
      });
      return toContract(plan);
    });
  }
}
```

## `apps/api/src/pricing/selection-rule-matcher.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\src\pricing\selection-rule-matcher.ts`
- Lines: 448

### Top-level declarations / exports

- `const PHASE_7B_BASE_PLAN_CODES: readonly BasePlanCode[]`
- `export class InvalidPricingIntervalError extends Error`
- `export class PricingConfigurationError extends Error`
- `export class PricingExtraPriceMissingError extends PricingConfigurationError`
- `export class PricingPriceMissingError extends PricingConfigurationError`
- `export class PricingRuleAmbiguousError extends PricingConfigurationError`
- `export class PricingRuleInvalidError extends PricingConfigurationError`
- `export class PricingRuleNotFoundError extends PricingConfigurationError`
- `export const MAX_DURATION_MINUTES`
- `export const MAX_LOCAL_MINUTE`
- `export const MIN_DURATION_MINUTES`
- `export const QUARTER_HOUR_MINUTES`
- `export const RULE_VERSION_PHASE_4`
- `export const RULE_VERSION_PHASE_7B`
- `export const TIMEZONE_ASIA_HO_CHI_MINH`
- `export function calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown`
- `export function localMinuteOfDay(date: Date, timezone: string): number`
- `export function validateActiveRuleSet(`
- `export interface CatalogEntry`
- `export interface PricingBreakdown`
- `export interface PricingCatalog`
- `export interface PricingInput`
- `export interface RuleSetValidationOptions`
- `export type BasePlanCode`
- `export type PricingRuleVersion`
- `export type RatePlanCode`
- `function activePrice(`
- `function isKnownRatePlanCode(code: string): code is RatePlanCode`
- `function isQuarterHour(value: number): boolean`
- `function matchesWindow(`
- `function parseInstant(value: string): Date`
- `function validateSelectionRuleForCatalog(catalog: PricingCatalog, code: RatePlanCode): void`
- `function validateTimezone(timezone: string): void`

### Function / method signatures

- `activePrice(catalog, 'EXTRA_HOUR', input.priceTierCode, PricingExtraPriceMissingError)`
- `activePrice(catalog, 'EXTRA_HOUR', tierCode, PricingExtraPriceMissingError)`
- `activePrice(catalog, winner.code, tierCode, PricingPriceMissingError)`
- `export function calculatePricing(input: PricingInput, catalog: PricingCatalog)`
- `export function localMinuteOfDay(date: Date, timezone: string)`
- `for (const code of Object.keys(catalog))`
- `for (const code of PHASE_7B_BASE_PLAN_CODES)`
- `for (const code of basePlanCodes)`
- `for (const duration of durationMinutes)`
- `for (const localCheckIn of checkInMinutes)`
- `for (const tierCode of options.requiredPriceTierCodes)`
- `for (let dur = MIN_DURATION_MINUTES; dur <= MAX_DURATION_MINUTES; dur += QUARTER_HOUR_MINUTES)`
- `function isKnownRatePlanCode(code: string)`
- `function isQuarterHour(value: number)`
- `function parseInstant(value: string)`
- `function validateSelectionRuleForCatalog(catalog: PricingCatalog, code: RatePlanCode)`
- `function validateTimezone(timezone: string)`
- `if (!Number.isSafeInteger(entry.priority) || entry.priority < 0 || entry.priority > 1_000)`
- `if (!entry.isBasePlan)`
- `if (!isKnownRatePlanCode(code))`
- `if ((entry.minCheckInMinuteInclusive === null) !== (entry.maxCheckInMinuteExclusive === null))`
- `if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan)`
- `if (entry === undefined)`
- `if (entry.includedDurationMinutes > entry.maxDurationMinutesInclusive)`
- `if (entry.isBasePlan)`
- `if (entry.maxCheckInMinuteExclusive <= entry.minCheckInMinuteInclusive)`
- `if (entry.minCheckInMinuteInclusive !== null && entry.maxCheckInMinuteExclusive !== null)`
- `if (entry.minCheckInMinuteInclusive >= MAX_LOCAL_MINUTE)`
- `if (entry.minDurationMinutesInclusive === null || entry.maxDurationMinutesInclusive === null)`
- `if (extraUnits > 0)`
- `if (matched.length === 0)`
- `if (matchesWindow(entry, localCheckIn, duration))`
- `if (matchesWindow(entry, localCheckIn, durationMinutes))`
- `if (selectedEntry === undefined)`
- `if (topMatches.length > 1)`
- `if (winner === undefined)`
- `if (winnerEntry === undefined)`
- `validateSelectionRuleForCatalog(catalog, code)`
- `validateTimezone(input.timezone)`

### Database tables / schema references

- `* (\`ratePlans\` + \`ratePlanPrices\`) and a {@link PricingInput} describing a`
- `* The matcher accepts an immutable PricingCatalog derived from PostgreSQL`

### External HTTP calls

- None detected by static scan.

### Timezone / date handling

- `const date = new Date(value);`
- `const parts = new Intl.DateTimeFormat('en-GB', {`
- `date.getUTCMilliseconds() !== 0 ||`
- `date.getUTCMinutes() % QUARTER_HOUR_MINUTES !== 0`
- `date.getUTCSeconds() !== 0 ||`
- `export const TIMEZONE_ASIA_HO_CHI_MINH = 'Asia/Ho_Chi_Minh';`
- `new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();`

### Money / arithmetic operations

- `*`
- `*   - it never logs;`
- `*   - it never mutates its arguments.`
- `*   - it never reads the database, environment variables, or web APIs;`
- `* (\`ratePlans\` + \`ratePlanPrices\`) and a {@link PricingInput} describing a`
- `* Phase 7B pure rule matcher.`
- `* The grid is finite (96 check-in minutes × 93 duration steps) so this`
- `* The matcher accepts an immutable PricingCatalog derived from PostgreSQL`
- `* The matcher is **pure**:`
- `* Time-of-day semantics use the property timezone supplied by the quote`
- `* Validate the tentative active rule set against every reachable public`
- `* customer booking interval. It returns the highest-priority matching base`
- `* input. Throws when coverage or priority uniqueness is violated.`
- `* path.`
- `* plan together with the extra-hour count, or raises a safe pricing error.`
- `* runs at ADMIN update/activation time only, never on the public quote`
- `* service, keeping the matcher deterministic across server hosts.`
- `*/`
- `/**`
- `activePrice(catalog, 'EXTRA_HOUR', input.priceTierCode, PricingExtraPriceMissingError) *`
- `amountVnd: extraAmountVnd,`
- `baseAmountVnd,`
- `const amount = plan?.prices[tier];`
- `const baseAmountVnd = activePrice(`
- `const durationMinutes = (checkOut.getTime() - checkIn.getTime()) / 60_000;`
- `const extraAmountVnd =`
- `const extraUnits = Math.max(0, Math.ceil((duration - baseMinutes) / 60));`
- `const extraUnits = Math.max(0, Math.ceil((durationMinutes - baseMinutes) / 60));`
- `export const TIMEZONE_ASIA_HO_CHI_MINH = 'Asia/Ho_Chi_Minh';`
- `extraAmountVnd,`
- `input.priceTierCode,`
- `readonly amountVnd: number;`
- `readonly baseAmountVnd: number;`
- `readonly extraAmountVnd: number;`
- `readonly priceTierCode: string;`
- `readonly prices: Readonly<Record<string, number>>;`
- `readonly totalAmountVnd: number;`
- `return hour * 60 + minute;`
- `throw new ErrorType('An active price is required for the selected pricing rule.');`
- `totalAmountVnd: baseAmountVnd + extraAmountVnd,`
- `{ code: winner.code as RatePlanCode, amountVnd: baseAmountVnd, units: 1 },`

### Routing decorators / endpoint declarations

- None detected by static scan.

### Verbatim source

```typescript
/**
 * Phase 7B pure rule matcher.
 *
 * The matcher accepts an immutable PricingCatalog derived from PostgreSQL
 * (`ratePlans` + `ratePlanPrices`) and a {@link PricingInput} describing a
 * customer booking interval. It returns the highest-priority matching base
 * plan together with the extra-hour count, or raises a safe pricing error.
 *
 * The matcher is **pure**:
 *   - it never reads the database, environment variables, or web APIs;
 *   - it never logs;
 *   - it never mutates its arguments.
 *
 * Time-of-day semantics use the property timezone supplied by the quote
 * service, keeping the matcher deterministic across server hosts.
 */

export type RatePlanCode =
  | 'THREE_HOUR_COMBO'
  | 'FIVE_HOUR_COMBO'
  | 'LUNCH_COMBO'
  | 'NIGHT_COMBO'
  | 'DAY_COMBO'
  | 'EXTRA_HOUR';

export type BasePlanCode = Exclude<RatePlanCode, 'EXTRA_HOUR'>;

export const RULE_VERSION_PHASE_7B = 'phase-7b-data-driven-pricing-v1' as const;
export const RULE_VERSION_PHASE_4 = 'phase-4-pricing-availability-v1' as const;

export type PricingRuleVersion = typeof RULE_VERSION_PHASE_4 | typeof RULE_VERSION_PHASE_7B;

export interface PricingInput {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly priceTierCode: string;
  readonly timezone: string;
}

export interface CatalogEntry {
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly isBasePlan: boolean;
  readonly includedDurationMinutes: number;
  readonly priority: number;
  readonly minCheckInMinuteInclusive: number | null;
  readonly maxCheckInMinuteExclusive: number | null;
  readonly minDurationMinutesInclusive: number | null;
  readonly maxDurationMinutesInclusive: number | null;
  readonly prices: Readonly<Record<string, number>>;
}

export interface PricingCatalog {
  readonly [code: string]: CatalogEntry;
}

export interface PricingBreakdown {
  readonly ruleVersion: typeof RULE_VERSION_PHASE_7B;
  readonly selectedPlanCode: BasePlanCode;
  readonly basePlanCode: BasePlanCode;
  readonly baseMinutes: number;
  readonly extraUnits: number;
  readonly baseAmountVnd: number;
  readonly extraAmountVnd: number;
  readonly totalAmountVnd: number;
  readonly lineItems: readonly {
    readonly code: RatePlanCode;
    readonly amountVnd: number;
    readonly units: number;
  }[];
}

export const TIMEZONE_ASIA_HO_CHI_MINH = 'Asia/Ho_Chi_Minh';
export const MIN_DURATION_MINUTES = 60;
export const MAX_DURATION_MINUTES = 1_440;
export const QUARTER_HOUR_MINUTES = 15;
export const MAX_LOCAL_MINUTE = 1_440;

export class InvalidPricingIntervalError extends Error {}
export class PricingConfigurationError extends Error {}
export class PricingRuleNotFoundError extends PricingConfigurationError {
  public readonly code = 'PRICING_RULE_NOT_FOUND';
}
export class PricingRuleAmbiguousError extends PricingConfigurationError {
  public readonly code = 'PRICING_RULE_AMBIGUOUS';
}
export class PricingRuleInvalidError extends PricingConfigurationError {
  public readonly code = 'PRICING_RULE_INVALID';
}
export class PricingPriceMissingError extends PricingConfigurationError {
  public readonly code = 'PRICING_PRICE_MISSING';
}
export class PricingExtraPriceMissingError extends PricingConfigurationError {
  public readonly code = 'PRICING_EXTRA_PRICE_MISSING';
}

function parseInstant(value: string): Date {
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0 ||
    date.getUTCMinutes() % QUARTER_HOUR_MINUTES !== 0
  ) {
    throw new InvalidPricingIntervalError('Pricing timestamps must use a 15-minute increment.');
  }
  return date;
}

export function localMinuteOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

function isQuarterHour(value: number): boolean {
  return value >= 0 && value <= MAX_LOCAL_MINUTE && value % QUARTER_HOUR_MINUTES === 0;
}

function isKnownRatePlanCode(code: string): code is RatePlanCode {
  return [
    'THREE_HOUR_COMBO',
    'FIVE_HOUR_COMBO',
    'LUNCH_COMBO',
    'NIGHT_COMBO',
    'DAY_COMBO',
    'EXTRA_HOUR',
  ].includes(code);
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
  } catch {
    throw new PricingRuleInvalidError('Property timezone is invalid.');
  }
}

function activePrice(
  catalog: PricingCatalog,
  code: RatePlanCode,
  tier: string,
  ErrorType: typeof PricingPriceMissingError | typeof PricingExtraPriceMissingError,
): number {
  const plan = catalog[code];
  const amount = plan?.prices[tier];
  if (
    plan?.status !== 'ACTIVE' ||
    amount === undefined ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    throw new ErrorType('An active price is required for the selected pricing rule.');
  }
  return amount;
}

function validateSelectionRuleForCatalog(catalog: PricingCatalog, code: RatePlanCode): void {
  const entry = catalog[code];
  if (entry === undefined) return;
  if (!Number.isSafeInteger(entry.priority) || entry.priority < 0 || entry.priority > 1_000) {
    throw new PricingRuleInvalidError(`Pricing rule ${code} has an invalid priority.`);
  }
  if (
    !Number.isSafeInteger(entry.includedDurationMinutes) ||
    entry.includedDurationMinutes < MIN_DURATION_MINUTES ||
    entry.includedDurationMinutes > MAX_DURATION_MINUTES ||
    entry.includedDurationMinutes % QUARTER_HOUR_MINUTES !== 0
  ) {
    throw new PricingRuleInvalidError(`Pricing rule ${code} has an invalid included duration.`);
  }
  if (entry.isBasePlan) {
    if (
      entry.minDurationMinutesInclusive === null ||
      entry.maxDurationMinutesInclusive === null ||
      entry.minDurationMinutesInclusive < MIN_DURATION_MINUTES ||
      entry.maxDurationMinutesInclusive > MAX_DURATION_MINUTES ||
      entry.minDurationMinutesInclusive > entry.maxDurationMinutesInclusive ||
      !Number.isSafeInteger(entry.minDurationMinutesInclusive) ||
      !Number.isSafeInteger(entry.maxDurationMinutesInclusive)
    ) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} has an invalid duration selection range.`,
      );
    }
    if (
      entry.minDurationMinutesInclusive % QUARTER_HOUR_MINUTES !== 0 ||
      entry.maxDurationMinutesInclusive % QUARTER_HOUR_MINUTES !== 0
    ) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} duration values must use 15-minute increments.`,
      );
    }
    if (entry.includedDurationMinutes > entry.maxDurationMinutesInclusive) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} included duration must not exceed its maximum duration.`,
      );
    }
    if ((entry.minCheckInMinuteInclusive === null) !== (entry.maxCheckInMinuteExclusive === null)) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} check-in window must be set as a pair or both null.`,
      );
    }
    if (entry.minCheckInMinuteInclusive !== null && entry.maxCheckInMinuteExclusive !== null) {
      if (
        !isQuarterHour(entry.minCheckInMinuteInclusive) ||
        !isQuarterHour(entry.maxCheckInMinuteExclusive)
      ) {
        throw new PricingRuleInvalidError(
          `Base plan ${code} check-in window must use 15-minute increments.`,
        );
      }
      if (entry.maxCheckInMinuteExclusive <= entry.minCheckInMinuteInclusive) {
        throw new PricingRuleInvalidError(`Base plan ${code} check-in window must have max > min.`);
      }
      if (entry.minCheckInMinuteInclusive >= MAX_LOCAL_MINUTE) {
        throw new PricingRuleInvalidError(
          `Base plan ${code} check-in window must not wrap midnight.`,
        );
      }
    }
  } else {
    if (
      entry.minCheckInMinuteInclusive !== null ||
      entry.maxCheckInMinuteExclusive !== null ||
      entry.minDurationMinutesInclusive !== null ||
      entry.maxDurationMinutesInclusive !== null
    ) {
      throw new PricingRuleInvalidError(
        `Non-base plan ${code} must not declare a selection window.`,
      );
    }
  }
}

function matchesWindow(
  entry: CatalogEntry,
  localCheckInMinute: number,
  durationMinutes: number,
): boolean {
  if (!entry.isBasePlan) return false;
  if (
    entry.minCheckInMinuteInclusive !== null &&
    entry.maxCheckInMinuteExclusive !== null &&
    (localCheckInMinute < entry.minCheckInMinuteInclusive ||
      localCheckInMinute >= entry.maxCheckInMinuteExclusive)
  ) {
    return false;
  }
  if (entry.minDurationMinutesInclusive === null || entry.maxDurationMinutesInclusive === null) {
    return false;
  }
  return (
    durationMinutes >= entry.minDurationMinutesInclusive &&
    durationMinutes <= entry.maxDurationMinutesInclusive
  );
}

export function calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown {
  const checkIn = parseInstant(input.checkIn);
  const checkOut = parseInstant(input.checkOut);
  const durationMinutes = (checkOut.getTime() - checkIn.getTime()) / 60_000;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new InvalidPricingIntervalError('Pricing duration must be between 1 and 24 hours.');
  }

  validateTimezone(input.timezone);
  const localCheckIn = localMinuteOfDay(checkIn, input.timezone);

  const basePlanCodes: readonly BasePlanCode[] = [
    'THREE_HOUR_COMBO',
    'FIVE_HOUR_COMBO',
    'LUNCH_COMBO',
    'NIGHT_COMBO',
    'DAY_COMBO',
  ];

  const matched: { code: BasePlanCode; priority: number }[] = [];
  for (const code of basePlanCodes) {
    const entry = catalog[code];
    if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan) continue;
    validateSelectionRuleForCatalog(catalog, code);
    if (matchesWindow(entry, localCheckIn, durationMinutes)) {
      matched.push({ code, priority: entry.priority });
    }
  }

  if (matched.length === 0) {
    throw new PricingRuleNotFoundError(
      'No active base plan matches the requested check-in and duration.',
    );
  }

  const highestPriority = matched.reduce(
    (max, current) => (current.priority > max ? current.priority : max),
    -Infinity,
  );
  const topMatches = matched.filter((m) => m.priority === highestPriority);
  if (topMatches.length > 1) {
    throw new PricingRuleAmbiguousError(
      `Multiple active base plans share the highest priority (${highestPriority}).`,
    );
  }

  const winner = topMatches[0];
  if (winner === undefined) {
    throw new PricingRuleNotFoundError('No active base plan matched.');
  }

  const selectedEntry = catalog[winner.code];
  if (selectedEntry === undefined) {
    throw new PricingRuleInvalidError(`Selected plan ${winner.code} not found in catalog.`);
  }

  const baseMinutes = selectedEntry.includedDurationMinutes;
  const extraUnits = Math.max(0, Math.ceil((durationMinutes - baseMinutes) / 60));

  const baseAmountVnd = activePrice(
    catalog,
    winner.code,
    input.priceTierCode,
    PricingPriceMissingError,
  );
  const extraAmountVnd =
    extraUnits === 0
      ? 0
      : (validateSelectionRuleForCatalog(catalog, 'EXTRA_HOUR'),
        activePrice(catalog, 'EXTRA_HOUR', input.priceTierCode, PricingExtraPriceMissingError) *
          extraUnits);
  const lineItems = [
    { code: winner.code as RatePlanCode, amountVnd: baseAmountVnd, units: 1 },
    ...(extraUnits === 0
      ? []
      : [
          {
            code: 'EXTRA_HOUR' as const,
            amountVnd: extraAmountVnd,
            units: extraUnits,
          },
        ]),
  ];

  return Object.freeze({
    ruleVersion: RULE_VERSION_PHASE_7B,
    selectedPlanCode: winner.code,
    basePlanCode: winner.code,
    baseMinutes,
    extraUnits,
    baseAmountVnd,
    extraAmountVnd,
    totalAmountVnd: baseAmountVnd + extraAmountVnd,
    lineItems: Object.freeze(lineItems),
  });
}

const PHASE_7B_BASE_PLAN_CODES: readonly BasePlanCode[] = [
  'THREE_HOUR_COMBO',
  'FIVE_HOUR_COMBO',
  'LUNCH_COMBO',
  'NIGHT_COMBO',
  'DAY_COMBO',
];

export interface RuleSetValidationOptions {
  readonly requiredPriceTierCodes: readonly string[];
}

/**
 * Validate the tentative active rule set against every reachable public
 * input. Throws when coverage or priority uniqueness is violated.
 *
 * The grid is finite (96 check-in minutes × 93 duration steps) so this
 * runs at ADMIN update/activation time only, never on the public quote
 * path.
 */
export function validateActiveRuleSet(
  catalog: PricingCatalog,
  options: RuleSetValidationOptions,
): void {
  for (const code of Object.keys(catalog)) {
    if (!isKnownRatePlanCode(code)) {
      throw new PricingRuleInvalidError(`Unknown pricing rule ${code}.`);
    }
    validateSelectionRuleForCatalog(catalog, code);
  }

  const checkInMinutes: number[] = [];
  for (
    let minute = 0;
    minute <= MAX_LOCAL_MINUTE - QUARTER_HOUR_MINUTES;
    minute += QUARTER_HOUR_MINUTES
  ) {
    checkInMinutes.push(minute);
  }
  const durationMinutes: number[] = [];
  for (let dur = MIN_DURATION_MINUTES; dur <= MAX_DURATION_MINUTES; dur += QUARTER_HOUR_MINUTES) {
    durationMinutes.push(dur);
  }

  for (const localCheckIn of checkInMinutes) {
    for (const duration of durationMinutes) {
      const matched: { code: BasePlanCode; priority: number }[] = [];
      for (const code of PHASE_7B_BASE_PLAN_CODES) {
        const entry = catalog[code];
        if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan) continue;
        if (matchesWindow(entry, localCheckIn, duration)) {
          matched.push({ code, priority: entry.priority });
        }
      }
      if (matched.length === 0) {
        throw new PricingRuleNotFoundError(
          `No active base plan matches check-in ${localCheckIn} with duration ${duration}.`,
        );
      }
      const highestPriority = matched.reduce(
        (max, current) => (current.priority > max ? current.priority : max),
        -Infinity,
      );
      const topMatches = matched.filter((m) => m.priority === highestPriority);
      if (topMatches.length > 1) {
        throw new PricingRuleAmbiguousError(
          `Multiple active base plans share the highest priority ${highestPriority} for check-in ${localCheckIn} and duration ${duration}.`,
        );
      }
      const winner = topMatches[0];
      if (winner === undefined) continue;
      const winnerEntry = catalog[winner.code];
      if (winnerEntry === undefined) continue;
      const baseMinutes = winnerEntry.includedDurationMinutes;
      const extraUnits = Math.max(0, Math.ceil((duration - baseMinutes) / 60));
      for (const tierCode of options.requiredPriceTierCodes) {
        activePrice(catalog, winner.code, tierCode, PricingPriceMissingError);
        if (extraUnits > 0) {
          activePrice(catalog, 'EXTRA_HOUR', tierCode, PricingExtraPriceMissingError);
        }
      }
    }
  }
}
```

## Relevant API test cases

### `apps/api/test/availability.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\availability.service.test.ts`

### Test case titles

- `describe('AvailabilityService'`
- `it('rejects unaligned or over-24-hour intervals before database lookup'`
- `it('returns only safe room-type availability, excluding blocked physical rooms'`

### `apps/api/test/booking/booking-detail.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\booking\booking-detail.service.test.ts`

### Test case titles

- `describe('BookingDetailService'`
- `it('emits a null holdExpiresAt when the booking is not in HOLD state'`
- `it('exposes a safe coupon summary when an active application is attached'`
- `it('masks very short phone numbers as-is'`
- `it('omits the coupon summary when no application row is attached'`
- `it('rejects when no session token is provided'`
- `it('returns masked contact fields and serialised timestamps for the happy path'`
- `it('throws when the booking code is unknown'`

### `apps/api/test/booking/booking-hold-status.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\booking\booking-hold-status.service.test.ts`

### Test case titles

- `describe('BookingHoldStatusService'`
- `it('executes the status query exactly once per call'`
- `it('parses string timestamps returned by the driver'`
- `it('rejects invalid input via Zod'`
- `it('returns EXPIRED when hold_expires_at is in the past'`
- `it('returns HOLD with the future expiry when the hold is still active'`
- `it('returns UNKNOWN for non-HOLD bookings (the hold phase is over)'`
- `it('returns UNKNOWN when no row matches the bookingCode + email digest pair'`

### `apps/api/test/booking/booking-hold.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\booking\booking-hold.service.test.ts`

### Test case titles

- `describe('BookingHoldService'`
- `it('exposes the expected error code on BookingHoldError'`
- `it('forwards the normalized contact and parameters to createBookingHoldWithRetry'`
- `it('maps unknown errors to INTERNAL_ERROR'`
- `it('omits the coupon summary when no coupon was applied'`
- `it('rejects invalid input via Zod'`
- `it('surfaces a safe coupon summary when the booking HOLD includes one'`

### `apps/api/test/customer/customer-profile.schema.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\customer\customer-profile.schema.test.ts`

### Test case titles

- `describe('parseCustomerProfilePatch'`
- `it('parses a full payload with E.164 phone and address fields'`
- `it('parses a minimal payload with just name'`
- `it('rejects blank name'`
- `it('rejects invalid country code'`
- `it('rejects invalid phone format'`
- `it('rejects missing name'`
- `it('rejects non-object payloads'`
- `it('rejects overly-long name'`
- `it('treats empty trimmed strings as null'`
- `it('truncates oversize text fields to the documented maximums'`

### `apps/api/test/customer-session.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\customer-session.service.test.ts`

### Test case titles

- `describe('CustomerSessionService — security boundary'`
- `it('does not leak ADMIN actor context when a CUSTOMER request is made'`
- `it('passes the request id and headers to the underlying session reader'`
- `it('rejects when an ADMIN session is presented on a CUSTOMER route'`
- `it('rejects when no session is present'`
- `it('returns the actor for an ACTIVE CUSTOMER session'`

### `apps/api/test/integration/admin-booking-lifecycle.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\admin-booking-lifecycle.integration.test.ts`

### Test case titles

- `describe('Audit / rollback'`
- `describe('Cancel CONFIRMED'`
- `describe('Cancel HOLD'`
- `describe('Check-in / Check-out'`
- `describe('Concurrency'`
- `describe('No-show'`
- `describe('Not-found'`
- `describe('Operational reviews'`
- `describe('Phase 7G admin booking lifecycle'`
- `describe('Read / contact integrity'`
- `it('1. releases the BOOKING inventory block'`
- `it('10. no-show before expected check-in is rejected'`
- `it('11. no-show exactly at expected check-in succeeds'`
- `it('12. no-show releases inventory'`
- `it('13. cancel vs check-in race has exactly one winner'`
- `it('14. check-in vs no-show race has exactly one winner'`
- `it('15. duplicate check-out is rejected'`
- `it('17. audit failure rolls back the complete mutation'`
- `it('18. review resolution is idempotent'`
- `it('19. concurrent review resolution has exactly one winner'`
- `it('2. releases a RESERVED coupon application'`
- `it('20. historical bookings remain readable with null timestamps'`
- `it('21. contact snapshots remain immutable after a transition'`
- `it('3. duplicate cancel has one business effect and is rejected as transition'`
- `it('4. preserves the SUCCEEDED payment row untouched'`
- `it('5. preserves a REDEEMED coupon application untouched'`
- `it('6. creates exactly one OPEN operational review for paid cancellation'`
- `it('7. duplicate paid cancellation creates no second review'`
- `it('8. check-in preserves inventory blocking'`
- `it('9. check-out releases inventory'`
- `it('rejects operations on a missing booking with BookingNotFoundError'`
- `it('reports not-found errors cleanly'`

### `apps/api/test/integration/availability.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\availability.integration.test.ts`

### Test case titles

- `describe('availability inventory search'`
- `it('reports an exhausted type, then restores it after the source block is released'`
- `it('returns active room types in deterministic name order, ignores inactive data, and creates no reservation'`
- `it('returns no eligible room type for capacity beyond its public capacity'`
- `it('uses [) inventory blocks, excludes only blocked rooms, and exposes no physical IDs'`

### `apps/api/test/integration/coupon-quote.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\coupon-quote.integration.test.ts`

### Test case titles

- `describe('coupon-aware quote issuance'`
- `it('applies a fixed discount provisionally without creating an application row'`
- `it('applies a percentage discount with a maximum cap'`
- `it('issues a quote without a coupon when no code is supplied'`
- `it('persists the coupon snapshot in the quote row for later HOLD revalidation'`
- `it('rejects a scoped coupon when the room type is not allowed'`
- `it('rejects an unknown coupon code with a safe public error'`

### `apps/api/test/integration/customer-module.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\customer-module.integration.test.ts`

### Test case titles

- `describe('customer module — profile, ownership, claim, payment status'`
- `it('STAGE F: DISABLED CUSTOMER cannot claim a booking even with a valid guest session'`
- `it('STAGE G: profile is empty for a fresh CUSTOMER and patches create a row + audit event'`
- `it('STAGE H: listForCustomer only returns bookings owned by the CUSTOMER'`
- `it('STAGE I: claim links the booking to the CUSTOMER and rejects a foreign CUSTOMER'`
- `it('STAGE J-extension: detailForCustomer refuses to leak bookings the CUSTOMER does not own'`
- `it('STAGE J: detailForCustomer returns authoritative paymentStatus from the payments table'`

### `apps/api/test/integration/customer-oauth.deterministic.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\customer-oauth.deterministic.integration.test.ts`

### Test case titles

- `describe('deterministic OAuth — different Google subject, same email (CASE 3)'`
- `describe('deterministic OAuth — disabled CUSTOMER (CASE 12)'`
- `describe('deterministic OAuth — first Google sign-in (CASE 1)'`
- `describe('deterministic OAuth — invalid authorization code (CASE 6)'`
- `describe('deterministic OAuth — missing email (CASE 7)'`
- `describe('deterministic OAuth — provider forces a transient error (CASE 6, server-side failure)'`
- `describe('deterministic OAuth — repeat Google sign-in (CASE 2)'`
- `describe('deterministic OAuth — replayed authorization code (CASE 5)'`
- `it('Better Auth surfaces a controlled error when the token endpoint returns an error'`
- `it('creates one CUSTOMER user, one Google account row, and one session'`
- `it('does not silently link; the second subject with the same email does not produce a new user'`
- `it('fails closed when the userinfo response carries no email claim'`
- `it('rejects a second exchange of the same code with invalid_grant'`
- `it('returns invalid_grant when exchanging an unknown code'`
- `it('reuses the existing CUSTOMER row; no duplicate user or account'`
- `it('sign-in succeeds for ACTIVE CUSTOMER and fails for DISABLED CUSTOMER'`

### `apps/api/test/integration/public-booking.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\public-booking.integration.test.ts`

### Test case titles

- `describe('public booking + guest access vertical slice'`
- `it('rejects a fifth OTP request within the request window for the same booking + email'`
- `it('returns a decoy OTP response when the booking code is well-formed but unknown'`
- `it('runs HOLD → OTP request → verify → cookie → detail → logout end-to-end'`

### `apps/api/test/integration/quote.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\quote.integration.test.ts`

### Test case titles

- `describe('immutable quote issuance'`
- `it('issues a persisted immutable snapshot with database-time 15-minute expiry and no inventory reservation'`
- `it('rejects incomplete pricing and unavailable inventory without writing a quote'`

### `apps/api/test/integration/rate-plan.integration.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\integration\rate-plan.integration.test.ts`

### Test case titles

- `describe('rate plan administration transaction'`
- `it('rejects a selection rule that breaks the rule set'`
- `it('rejects incomplete activation, then activates after an audited price update'`
- `it('updates a selection rule and validates the tentative rule set'`

### `apps/api/test/pricing-engine.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\pricing-engine.test.ts`

### Test case titles

- `describe('deterministic pricing engine'`
- `it('does not let a malformed inactive plan block an unrelated public quote'`
- `it('keeps base and extra price failures distinct within the configuration hierarchy'`
- `it('rejects an active rule set when a required tier lacks a winning-plan price'`
- `it('rejects an active selection rule with an unsafe priority'`
- `it('rejects equal-priority ambiguity across the active rule set'`
- `it('rejects extra units when EXTRA_HOUR has no active price'`
- `it('rejects invalid intervals and missing tier prices'`
- `it('rejects non-base plans that declare a selection window'`
- `it('uses the configured lunch price for every tier'`
- `it('uses the property-owned timezone supplied with the quote input'`

### `apps/api/test/quote.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\quote.service.test.ts`

### Test case titles

- `describe('QuoteService'`
- `it('does not issue an unavailable quote'`
- `it('turns an inactive or incomplete pricing catalog into a safe typed failure'`

### `apps/api/test/rate-plan.service.test.ts`

- Full path: `D:\Study\Project\Room Management\apps\api\test\rate-plan.service.test.ts`

### Test case titles

- `describe('RatePlanService'`
- `it('activates a complete plan and audits it in the same transaction'`
- `it('rejects activation when any active room-type tier is not priced'`
- `it('updates a VND price and writes an atomic scrubbed audit event'`

## Focused audit findings

### Plan selector

Exact selector function: `calculatePricing(input: PricingInput, catalog: PricingCatalog)` in `apps/api/src/pricing/selection-rule-matcher.ts`.

- Candidate base plans, in evaluation order: `THREE_HOUR_COMBO`, `FIVE_HOUR_COMBO`, `LUNCH_COMBO`, `NIGHT_COMBO`, `DAY_COMBO`.
- A candidate must be `ACTIVE`, `isBasePlan`, and satisfy its optional local check-in window and inclusive duration range.
- The winner is the sole candidate with the highest numeric `priority`; equal highest priorities throw `PricingRuleAmbiguousError`; no match throws `PricingRuleNotFoundError`.
- `EXTRA_HOUR` is never selected as a base plan; it is applied after selection when duration exceeds included base minutes.

### Duration / granularity validation

- `parseInstant` requires valid `Date` values, zero seconds/milliseconds, and UTC minutes divisible by 15.
- `calculatePricing` requires integer duration from 60 through 1,440 minutes.
- Catalog validation requires included and selection duration values to be safe integers, 15-minute aligned, and within 60–1,440 minutes.
- Selection windows are half-open: minimum inclusive, maximum exclusive.

### Extra-hour calculation

- Exact expression: `Math.max(0, Math.ceil((durationMinutes - baseMinutes) / 60))`.
- Extra price is multiplied by `extraUnits`; total is `baseAmountVnd + extraAmountVnd`.
- No `Math.round`, `Math.floor`, or `toFixed` is used in the pricing matcher for extra-hour calculation.

### Pricing / availability coupling

- Quote catalog loading combines active room-type/property lookup, rate-plan and rate-plan-price catalog construction, and overlapping active inventory-block checks in `apps/api/src/pricing/quote.repository.ts`.
- Standalone availability uses the same overlap predicate (`startsAt < checkOut` and `endsAt > checkIn`) and occupancy checks, but does not invoke `calculatePricing`.
- Quote issuance rejects unavailable source data before pricing; then passes `propertyTimezone` and `priceTierCode` into the pure matcher.

## Completeness note

This artifact includes the complete verbatim source text for every scanned source file and extracted static maps. The test section lists titles found by the Jest/Vitest-style `it`, `test`, and `describe` pattern.
