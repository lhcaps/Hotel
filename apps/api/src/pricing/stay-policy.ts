import type { AvailabilityPolicy } from '@room/contracts';

export function isWithinPropertyStayPolicy(
  checkIn: string,
  checkOut: string,
  policy: AvailabilityPolicy,
  now = Date.now(),
): boolean {
  const checkInMs = new Date(checkIn).getTime();
  const checkOutMs = new Date(checkOut).getTime();
  const durationMinutes = Math.ceil((checkOutMs - checkInMs) / 60_000);
  const leadMinutes = (checkInMs - now) / 60_000;
  const latestCheckIn = now + policy.maximumAdvanceBookingDays * 86_400_000;
  return (
    durationMinutes >= policy.minimumStayMinutes &&
    durationMinutes <= policy.maximumStayMinutes &&
    leadMinutes >= policy.minimumLeadTimeMinutes &&
    checkInMs <= latestCheckIn
  );
}

export function propertyStayPolicy(row: {
  readonly minimumStayMinutes: number;
  readonly maximumStayMinutes: number;
  readonly minimumLeadTimeMinutes: number;
  readonly maximumAdvanceBookingDays: number;
  readonly defaultOvernightDurationMinutes: number;
}): AvailabilityPolicy {
  return {
    minimumStayMinutes: row.minimumStayMinutes,
    maximumStayMinutes: row.maximumStayMinutes,
    minimumLeadTimeMinutes: row.minimumLeadTimeMinutes,
    maximumAdvanceBookingDays: row.maximumAdvanceBookingDays,
    defaultOvernightDurationMinutes: row.defaultOvernightDurationMinutes,
  };
}
