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
