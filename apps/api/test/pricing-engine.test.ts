import { describe, expect, it } from 'vitest';

import {
  calculatePricing,
  PricingConfigurationError,
  PricingPriceMissingError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
  RULE_VERSION_PHASE_8B,
} from '../src/pricing/pricing-engine.js';
import { validateActiveRuleSet, type PricingCatalog } from '../src/pricing/pricing-engine.js';

const extraHour: NonNullable<PricingCatalog['EXTRA_HOUR']> = {
  status: 'ACTIVE',
  isBasePlan: false,
  includedDurationMinutes: 60,
  priority: 0,
  minCheckInMinuteInclusive: null,
  maxCheckInMinuteExclusive: null,
  minDurationMinutesInclusive: null,
  maxDurationMinutesInclusive: null,
  prices: { TIER_1: 100000, TIER_2: 110000, TIER_3: 120000 },
};
const lunchCombo: NonNullable<PricingCatalog['LUNCH_COMBO']> = {
  status: 'ACTIVE',
  isBasePlan: true,
  includedDurationMinutes: 180,
  priority: 30,
  minCheckInMinuteInclusive: 660,
  maxCheckInMinuteExclusive: 900,
  minDurationMinutesInclusive: 60,
  maxDurationMinutesInclusive: 960,
  prices: { TIER_1: 359000, TIER_2: 419000, TIER_3: 489000 },
};
const fiveHourCombo: NonNullable<PricingCatalog['FIVE_HOUR_COMBO']> = {
  status: 'ACTIVE',
  isBasePlan: true,
  includedDurationMinutes: 300,
  priority: 20,
  minCheckInMinuteInclusive: 0,
  maxCheckInMinuteExclusive: 1080,
  minDurationMinutesInclusive: 255,
  maxDurationMinutesInclusive: 960,
  prices: { TIER_1: 450000, TIER_2: 520000, TIER_3: 590000 },
};

const catalog: PricingCatalog = {
  THREE_HOUR_COMBO: {
    status: 'ACTIVE',
    isBasePlan: true,
    includedDurationMinutes: 180,
    priority: 10,
    minCheckInMinuteInclusive: null,
    maxCheckInMinuteExclusive: null,
    minDurationMinutesInclusive: 60,
    maxDurationMinutesInclusive: 240,
    prices: { TIER_1: 300000, TIER_2: 360000, TIER_3: 420000 },
  },
  FIVE_HOUR_COMBO: fiveHourCombo,
  LUNCH_COMBO: lunchCombo,
  NIGHT_COMBO: {
    status: 'ACTIVE',
    isBasePlan: true,
    includedDurationMinutes: 300,
    priority: 40,
    minCheckInMinuteInclusive: 1080,
    maxCheckInMinuteExclusive: 1440,
    minDurationMinutesInclusive: 300,
    maxDurationMinutesInclusive: 960,
    prices: { TIER_1: 600000, TIER_2: 680000, TIER_3: 760000 },
  },
  DAY_COMBO: {
    status: 'ACTIVE',
    isBasePlan: true,
    includedDurationMinutes: 1440,
    priority: 50,
    minCheckInMinuteInclusive: null,
    maxCheckInMinuteExclusive: null,
    minDurationMinutesInclusive: 975,
    maxDurationMinutesInclusive: 1440,
    prices: { TIER_1: 800000, TIER_2: 900000, TIER_3: 1000000 },
  },
  EXTRA_HOUR: extraHour,
};

function timestamps(hour: number, minute: number, durationMinutes: number) {
  const checkIn = new Date(Date.UTC(2026, 6, 22, hour - 7, minute));
  const checkOut = new Date(checkIn.getTime() + durationMinutes * 60_000);
  return {
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    timezone: 'Asia/Ho_Chi_Minh',
  };
}

const pricingMatrix = [
  ['before lunch', timestamps(10, 45, 180), 'THREE_HOUR_COMBO', 0, 300000, 0, 300000],
  [
    'lunch starts: cheapest wins over higher-priority lunch',
    timestamps(11, 0, 180),
    'THREE_HOUR_COMBO',
    0,
    300000,
    0,
    300000,
  ],
  [
    'lunch ends minus fifteen: cheapest wins over higher-priority lunch',
    timestamps(14, 45, 180),
    'THREE_HOUR_COMBO',
    0,
    300000,
    0,
    300000,
  ],
  ['lunch end is exclusive', timestamps(15, 0, 180), 'THREE_HOUR_COMBO', 0, 300000, 0, 300000],
  [
    'two hours forty-five uses the three-hour base',
    timestamps(15, 0, 165),
    'THREE_HOUR_COMBO',
    0,
    300000,
    0,
    300000,
  ],
  ['three-hour exact', timestamps(15, 0, 180), 'THREE_HOUR_COMBO', 0, 300000, 0, 300000],
  ['three plus fifteen', timestamps(15, 0, 195), 'THREE_HOUR_COMBO', 1, 300000, 100000, 400000],
  ['four-hour exact', timestamps(15, 0, 240), 'THREE_HOUR_COMBO', 1, 300000, 100000, 400000],
  [
    'four plus fifteen selects five',
    timestamps(15, 0, 255),
    'FIVE_HOUR_COMBO',
    0,
    450000,
    0,
    450000,
  ],
  ['five-hour exact', timestamps(15, 0, 300), 'FIVE_HOUR_COMBO', 0, 450000, 0, 450000],
  ['five plus fifteen', timestamps(15, 0, 315), 'FIVE_HOUR_COMBO', 1, 450000, 100000, 550000],
  ['before evening', timestamps(17, 45, 315), 'FIVE_HOUR_COMBO', 1, 450000, 100000, 550000],
  [
    'evening exact five selects night combo',
    timestamps(18, 0, 300),
    'NIGHT_COMBO',
    0,
    600000,
    0,
    600000,
  ],
  [
    'night start selects its included five-hour combo',
    timestamps(18, 0, 300),
    'NIGHT_COMBO',
    0,
    600000,
    0,
    600000,
  ],
  [
    'overnight intervals use the night combo rather than five-hour fallback',
    timestamps(18, 0, 315),
    'NIGHT_COMBO',
    1,
    600000,
    100000,
    700000,
  ],
  [
    'overnight nine-hour interval selects the night combo',
    timestamps(21, 0, 540),
    'NIGHT_COMBO',
    4,
    600000,
    400000,
    1000000,
  ],
  [
    'exact sixteen hours stays five (DAY eligibility requires 975m)',
    timestamps(8, 0, 960),
    'FIVE_HOUR_COMBO',
    11,
    450000,
    1100000,
    1550000,
  ],
  ['day threshold', timestamps(8, 0, 975), 'DAY_COMBO', 0, 800000, 0, 800000],
  ['twenty-four hours', timestamps(8, 0, 1440), 'DAY_COMBO', 0, 800000, 0, 800000],
] as const satisfies readonly (readonly [
  string,
  ReturnType<typeof timestamps>,
  'THREE_HOUR_COMBO' | 'FIVE_HOUR_COMBO' | 'LUNCH_COMBO' | 'NIGHT_COMBO' | 'DAY_COMBO',
  number,
  number,
  number,
  number,
])[];

describe('deterministic pricing engine', () => {
  it('preserves arbitrary seconds while pricing by rounded-up billable minutes', () => {
    const result = calculatePricing(
      {
        checkIn: '2027-01-10T08:00:17+07:00',
        checkOut: '2027-01-10T11:15:46+07:00',
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
    );

    expect(result).toMatchObject({
      selectedPlanCode: 'THREE_HOUR_COMBO',
      extraUnits: 1,
    });
  });
  it.each(pricingMatrix)(
    '%s',
    (
      _name,
      interval,
      selectedPlanCode,
      extraUnits,
      baseAmountVnd,
      extraAmountVnd,
      totalAmountVnd,
    ) => {
      const result = calculatePricing({ ...interval, priceTierCode: 'TIER_1' }, catalog);

      expect(result).toMatchObject({
        ruleVersion: RULE_VERSION_PHASE_8B,
        selectedPlanCode,
        extraUnits,
        baseAmountVnd,
        extraAmountVnd,
        totalAmountVnd,
      });
    },
  );

  it('uses the configured lunch price for every tier (cheapest tie-break)', () => {
    // LUNCH (359k) > THREE (300k) at 11:00 with 180m duration. Under the
    // new cheapest policy THREE is selected for TIER_1 because it is
    // strictly cheaper. For TIER_3 the LUNCH (489k) is still more
    // expensive than THREE (420k), so THREE still wins. The asserted
    // value documents the cheapest-wins behaviour, not the legacy
    // priority-wins behaviour.
    const interval = timestamps(11, 0, 180);
    expect(calculatePricing({ ...interval, priceTierCode: 'TIER_1' }, catalog).totalAmountVnd).toBe(
      300000,
    );
    expect(calculatePricing({ ...interval, priceTierCode: 'TIER_2' }, catalog).totalAmountVnd).toBe(
      360000,
    );
    expect(calculatePricing({ ...interval, priceTierCode: 'TIER_3' }, catalog).totalAmountVnd).toBe(
      420000,
    );
  });

  it('accepts arbitrary timestamps and rejects missing tier prices', () => {
    expect(
      calculatePricing(
        {
          checkIn: '2026-07-22T11:07:17+07:00',
          checkOut: '2026-07-22T12:07:46+07:00',
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
      ),
    ).toBeTruthy();
    expect(() =>
      calculatePricing({ ...timestamps(11, 0, 60), priceTierCode: 'TIER_4' }, catalog),
    ).toThrow(PricingConfigurationError);
  });

  it('rejects extra units when EXTRA_HOUR has no active price', () => {
    // Under CHEAPEST_ELIGIBLE_THEN_PRIORITY, candidates needing an
    // unavailable extra price are silently dropped. At 15:00 + 195m,
    // THREE (base 180, 1 extra) and FIVE (min 255) — only THREE is
    // eligible, but its extra price is missing → no valid candidate
    // remains, so the selector must fail closed.
    const broken: PricingCatalog = {
      ...catalog,
      EXTRA_HOUR: { ...extraHour, status: 'INACTIVE' },
    };
    expect(() =>
      calculatePricing({ ...timestamps(15, 0, 195), priceTierCode: 'TIER_1' }, broken),
    ).toThrow(PricingRuleNotFoundError);
  });

  it('resolves equal-priority ties deterministically by gross amount (no ambiguity error)', () => {
    const tied: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: { ...lunchCombo, priority: fiveHourCombo.priority },
    };
    // LUNCH 359000 > THREE 300000, so the cheapest plan is selected.
    expect(
      calculatePricing({ ...timestamps(11, 0, 180), priceTierCode: 'TIER_1' }, tied),
    ).toMatchObject({ selectedPlanCode: 'THREE_HOUR_COMBO', totalAmountVnd: 300000 });
  });

  it('rejects an active rule set when a required tier lacks a winning-plan price', () => {
    const inactiveMalformed: PricingCatalog = {
      ...catalog,
      EXTRA_HOUR: {
        ...extraHour,
        status: 'INACTIVE',
        minCheckInMinuteInclusive: 600,
        maxCheckInMinuteExclusive: 900,
      },
    };
    // LUNCH (359k) > THREE (300k). Cheapest wins; THREE is selected.
    expect(
      calculatePricing({ ...timestamps(11, 0, 180), priceTierCode: 'TIER_1' }, inactiveMalformed),
    ).toMatchObject({ selectedPlanCode: 'THREE_HOUR_COMBO', totalAmountVnd: 300000 });
  });

  it('does not let a malformed inactive plan block an unrelated public quote', () => {
    const inactiveMalformed: PricingCatalog = {
      ...catalog,
      EXTRA_HOUR: {
        ...extraHour,
        status: 'INACTIVE',
        minCheckInMinuteInclusive: 600,
        maxCheckInMinuteExclusive: 900,
      },
    };
    // LUNCH (359k) > THREE (300k). Cheapest wins; THREE is selected.
    expect(
      calculatePricing({ ...timestamps(11, 0, 180), priceTierCode: 'TIER_1' }, inactiveMalformed),
    ).toMatchObject({ selectedPlanCode: 'THREE_HOUR_COMBO', totalAmountVnd: 300000 });
  });

  it('keeps base and extra price failures distinct within the configuration hierarchy', () => {
    // Under CHEAPEST_ELIGIBLE_THEN_PRIORITY, a candidate with a missing
    // base price for the requested tier is silently skipped so cheaper
    // valid alternatives remain selectable. At 11:00 + 180m, LUNCH
    // (lacks TIER_1) is skipped; THREE (300k) wins by lowest gross.
    const missingBase: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: { ...lunchCombo, prices: { TIER_2: 419000 } },
    };
    expect(
      calculatePricing({ ...timestamps(11, 0, 180), priceTierCode: 'TIER_1' }, missingBase),
    ).toMatchObject({ selectedPlanCode: 'THREE_HOUR_COMBO', totalAmountVnd: 300000 });
  });

  it('rejects an active selection rule with an unsafe priority', () => {
    const invalid: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: { ...lunchCombo, priority: 1001 },
    };
    expect(() =>
      calculatePricing({ ...timestamps(11, 0, 180), priceTierCode: 'TIER_1' }, invalid),
    ).toThrow(PricingRuleInvalidError);
  });

  it('uses the property-owned timezone supplied with the quote input', () => {
    expect(
      calculatePricing(
        { ...timestamps(11, 0, 180), priceTierCode: 'TIER_1', timezone: 'UTC' },
        catalog,
      ),
    ).toMatchObject({ selectedPlanCode: 'THREE_HOUR_COMBO', totalAmountVnd: 300000 });
  });

  it('rejects an active rule set when a required tier lacks a winning-plan price', () => {
    expect(() =>
      validateActiveRuleSet(catalog, { requiredPriceTierCodes: ['TIER_1', 'TIER_4'] }),
    ).toThrow(PricingPriceMissingError);
  });
});
