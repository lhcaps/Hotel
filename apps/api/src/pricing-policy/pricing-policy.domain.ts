export const PRICING_POLICY_RULE_SCHEMA_VERSION = 'operations-v3-b0.2-policy-v1' as const;
export const MAX_PRICING_POLICY_COMPONENT_LINES = 64;
export const MAX_PRICING_POLICY_SEARCH_STATES = 4096;

export type PricingPolicyStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED' | 'CANCELLED';
export type PricingPolicyApplicabilityBasis = 'QUOTE_INSTANT' | 'STAY_START';
export type PricingPolicyComponentKind = 'BASE_STAY' | 'EXTENSION';
export type PricingPolicyCoverageModel =
  'FIXED_ELAPSED' | 'LOCAL_CLOCK_WINDOW' | 'REQUEST_BOUNDARY';
export type PricingPolicyBillingModel = 'FIXED_OCCURRENCE' | 'STARTED_UNIT';
export type PricingPolicyBoundaryPosition = 'LEADING' | 'TRAILING';

export type PricingPolicyJsonPrimitive = string | number | boolean | null;
export type PricingPolicyJsonValue =
  | PricingPolicyJsonPrimitive
  | readonly PricingPolicyJsonValue[]
  | { readonly [key: string]: PricingPolicyJsonValue };
export type PricingPolicyJsonObject = { readonly [key: string]: PricingPolicyJsonValue };

export interface DraftPricingPolicyRoot {
  readonly id: string;
  readonly propertyId: string;
  readonly versionNumber: bigint;
  readonly internalName: string;
  readonly status: 'DRAFT';
  readonly applicabilityBasis: PricingPolicyApplicabilityBasis;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly timezoneSnapshot: string;
  readonly ruleSchemaVersion: string;
  readonly maximumComponentLines: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly changeNote: string | null;
  readonly legacyProvenance: PricingPolicyJsonObject | null;
}

export interface PublishedPricingPolicyRoot extends Omit<DraftPricingPolicyRoot, 'status'> {
  readonly status: 'PUBLISHED';
}

export interface PricingPolicyReleaseRoot extends Omit<DraftPricingPolicyRoot, 'status'> {
  readonly status: PricingPolicyStatus;
}

export interface DraftPricingPolicyComponent {
  readonly id: string;
  readonly policyVersionId: string;
  readonly componentCode: string;
  readonly componentKind: PricingPolicyComponentKind;
  readonly coverageModel: PricingPolicyCoverageModel;
  readonly billingModel: PricingPolicyBillingModel;
  readonly fixedDurationMinutes: number | null;
  readonly localStartMinuteInclusive: number | null;
  readonly localEndMinuteExclusive: number | null;
  readonly localEndDayOffset: number | null;
  readonly boundaryPosition: PricingPolicyBoundaryPosition | null;
  readonly boundaryMinDurationMinutes: number | null;
  readonly boundaryMaxDurationMinutes: number | null;
  readonly billingUnitMinutes: number | null;
  readonly minimumBillingUnits: number | null;
  readonly maximumBillingUnits: number | null;
  readonly maximumOccurrencesPerCandidate: number;
  readonly conditionComplexityRank: number;
  readonly tieBreakRank: number;
  readonly restrictionMetadata: PricingPolicyJsonObject;
  readonly displayMetadata: PricingPolicyJsonObject;
  readonly legacyProvenance: PricingPolicyJsonObject | null;
}

export interface DraftPricingPolicyPrice {
  readonly id: string;
  readonly propertyId: string;
  readonly policyVersionId: string;
  readonly componentId: string;
  readonly priceTierId: string;
  readonly amountVnd: bigint;
}

export interface DraftPricingPolicyEdge {
  readonly id: string;
  readonly policyVersionId: string;
  readonly predecessorComponentId: string;
  readonly successorComponentId: string;
  readonly restrictionMetadata: PricingPolicyJsonObject | null;
}

export interface DraftPricingPolicyAggregate {
  readonly root: DraftPricingPolicyRoot;
  readonly components: readonly DraftPricingPolicyComponent[];
  readonly prices: readonly DraftPricingPolicyPrice[];
  readonly edges: readonly DraftPricingPolicyEdge[];
}

export type PublishedPricingPolicyAggregate = Omit<DraftPricingPolicyAggregate, 'root'> & {
  readonly root: PublishedPricingPolicyRoot;
};

export type PricingPolicyReleaseAggregate = Omit<DraftPricingPolicyAggregate, 'root'> & {
  readonly root: PricingPolicyReleaseRoot;
};

export interface PricingPolicyValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface PricingPolicyValidationWarning {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface PricingPolicyValidationContext {
  readonly propertyId: string;
  readonly propertyTimezone: string;
  readonly establishedBasis?: PricingPolicyApplicabilityBasis;
  readonly priceTierIds: ReadonlySet<string>;
  readonly requiredPriceTierIds?: ReadonlySet<string>;
}

export interface PricingPolicyValidationResult {
  readonly errors: readonly PricingPolicyValidationError[];
  readonly warnings: readonly PricingPolicyValidationWarning[];
  readonly publicationReady: boolean;
  readonly normalized?: DraftPricingPolicyAggregate;
}
