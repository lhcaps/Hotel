/**
 * The cancellation policy is captured on the booking, not recalculated from
 * today's configuration. This keeps the customer preview, the execution
 * command, and any later refund review on the same commercial terms.
 */

export const CANCELLATION_POLICY_CODE = 'PEACENEST_STANDARD_V1';
export const CANCELLATION_POLICY_VERSION = 1;
export const CANCELLATION_REFUND_BASIS = 'PAID_AMOUNT' as const;
export const CANCELLATION_SEVEN_DAY_SECONDS = 7 * 24 * 60 * 60;
export const CANCELLATION_THREE_DAY_SECONDS = 3 * 24 * 60 * 60;

export interface CancellationPolicySnapshot {
  readonly code: typeof CANCELLATION_POLICY_CODE;
  readonly version: typeof CANCELLATION_POLICY_VERSION;
  readonly timezone: string;
  readonly refundBasis: typeof CANCELLATION_REFUND_BASIS;
  readonly capturedAt: string;
  readonly checkIn: string;
  readonly sevenDayDeadline: string;
  readonly threeDayDeadline: string;
  readonly bands: readonly [
    { readonly minimumSecondsBeforeCheckIn: 604800; readonly refundPercent: 100 },
    { readonly minimumSecondsBeforeCheckIn: 259200; readonly refundPercent: 50 },
    { readonly minimumSecondsBeforeCheckIn: 0; readonly refundPercent: 0 },
  ];
}

export interface CancellationEvaluation {
  readonly eligible: boolean;
  readonly outcome: 'NO_CHARGE' | 'REVIEW_REQUIRED' | 'NO_REFUND' | 'NOT_ELIGIBLE';
  readonly refundPercent: 100 | 50 | 0;
  readonly paidAmountVnd: bigint;
  readonly refundAmountVnd: bigint;
  readonly retainedAmountVnd: bigint;
  readonly secondsBeforeCheckIn: number;
  readonly policyMessage: string;
}

export function createCancellationPolicySnapshot(input: {
  readonly checkIn: Date;
  readonly timezone: string;
  readonly capturedAt: Date;
}): CancellationPolicySnapshot {
  if (input.timezone.trim() === '') throw new Error('Cancellation policy timezone is required');
  const checkIn = input.checkIn.getTime();
  const capturedAt = input.capturedAt.getTime();
  if (!Number.isFinite(checkIn) || !Number.isFinite(capturedAt)) {
    throw new Error('Cancellation policy dates must be valid');
  }
  const sevenDayDeadline = new Date(checkIn - CANCELLATION_SEVEN_DAY_SECONDS * 1_000).toISOString();
  const threeDayDeadline = new Date(checkIn - CANCELLATION_THREE_DAY_SECONDS * 1_000).toISOString();
  return {
    code: CANCELLATION_POLICY_CODE,
    version: CANCELLATION_POLICY_VERSION,
    timezone: input.timezone,
    refundBasis: CANCELLATION_REFUND_BASIS,
    capturedAt: input.capturedAt.toISOString(),
    checkIn: input.checkIn.toISOString(),
    sevenDayDeadline,
    threeDayDeadline,
    bands: [
      { minimumSecondsBeforeCheckIn: 604800, refundPercent: 100 },
      { minimumSecondsBeforeCheckIn: 259200, refundPercent: 50 },
      { minimumSecondsBeforeCheckIn: 0, refundPercent: 0 },
    ],
  };
}

export function evaluateCancellationPolicy(input: {
  readonly snapshot: CancellationPolicySnapshot;
  readonly now: Date;
  readonly paidAmountVnd: bigint;
  readonly bookingEligible: boolean;
}): CancellationEvaluation {
  if (input.paidAmountVnd < 0n) throw new Error('Paid amount cannot be negative');
  const checkIn = Date.parse(input.snapshot.checkIn);
  const now = input.now.getTime();
  if (!Number.isFinite(checkIn) || !Number.isFinite(now)) {
    throw new Error('Cancellation evaluation dates must be valid');
  }
  const secondsBeforeCheckIn = Math.floor((checkIn - now) / 1_000);
  const refundPercent: 100 | 50 | 0 = !input.bookingEligible
    ? 0
    : secondsBeforeCheckIn >= CANCELLATION_SEVEN_DAY_SECONDS
      ? 100
      : secondsBeforeCheckIn >= CANCELLATION_THREE_DAY_SECONDS
        ? 50
        : 0;
  const refundAmountVnd = (input.paidAmountVnd * BigInt(refundPercent)) / 100n;
  const retainedAmountVnd = input.paidAmountVnd - refundAmountVnd;
  const outcome = !input.bookingEligible
    ? 'NOT_ELIGIBLE'
    : input.paidAmountVnd === 0n
      ? 'NO_CHARGE'
      : refundAmountVnd === 0n
        ? 'NO_REFUND'
        : 'REVIEW_REQUIRED';
  return {
    eligible: input.bookingEligible,
    outcome,
    refundPercent,
    paidAmountVnd: input.paidAmountVnd,
    refundAmountVnd,
    retainedAmountVnd,
    secondsBeforeCheckIn,
    policyMessage: cancellationPolicyMessage({
      outcome,
      refundPercent,
      refundAmountVnd,
      timezone: input.snapshot.timezone,
    }),
  };
}

function cancellationPolicyMessage(input: {
  readonly outcome: CancellationEvaluation['outcome'];
  readonly refundPercent: 100 | 50 | 0;
  readonly refundAmountVnd: bigint;
  readonly timezone: string;
}): string {
  if (input.outcome === 'NOT_ELIGIBLE') {
    return 'Đặt phòng không còn đủ điều kiện hủy trực tuyến.';
  }
  if (input.outcome === 'NO_CHARGE') {
    return `Hủy trước giờ nhận phòng theo múi giờ ${input.timezone} sẽ giải phóng giữ chỗ và không phát sinh giao dịch.`;
  }
  if (input.refundPercent === 100) {
    return 'Hủy trước ít nhất 7 ngày: hoàn 100% số tiền đã thanh toán; bộ phận vận hành sẽ kiểm tra và xử lý hoàn tiền.';
  }
  if (input.refundPercent === 50) {
    return 'Hủy từ 3 đến dưới 7 ngày: cơ sở hoàn 50% số tiền đã thanh toán; bộ phận vận hành sẽ kiểm tra và xử lý hoàn tiền.';
  }
  return 'Hủy trong vòng 3 ngày: không có khoản hoàn từ số tiền đã thanh toán.';
}
