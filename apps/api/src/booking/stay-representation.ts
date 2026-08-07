export type BookingStayRepresentation = {
  readonly stayMode?: 'hourly' | 'overnight' | 'multi_night';
  readonly nightCount?: number | null;
  readonly pricingRuleVersion?: string | null;
};

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value));
}

export function readBookingStayRepresentation(snapshot: unknown): BookingStayRepresentation {
  const root = objectRecord(snapshot);
  const pricing = objectRecord(root?.pricing);
  if (root === undefined || pricing === undefined) return {};
  const mode = root.mode;
  const stayMode =
    mode === 'hourly' || mode === 'overnight' || mode === 'multi_night' ? mode : undefined;
  const nightCount =
    typeof pricing.displayNightCount === 'number' && Number.isInteger(pricing.displayNightCount)
      ? pricing.displayNightCount
      : undefined;
  const pricingRuleVersion =
    typeof pricing.ruleVersion === 'string' && pricing.ruleVersion.trim() !== ''
      ? pricing.ruleVersion
      : null;
  return {
    ...(stayMode === undefined ? {} : { stayMode }),
    ...(nightCount === undefined ? {} : { nightCount }),
    pricingRuleVersion,
  };
}
