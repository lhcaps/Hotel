import {
  MAX_PRICING_POLICY_COMPONENT_LINES,
  MAX_PRICING_POLICY_SEARCH_STATES,
  PRICING_POLICY_RULE_SCHEMA_VERSION,
  type DraftPricingPolicyAggregate,
  type DraftPricingPolicyComponent,
  type PricingPolicyJsonObject,
  type PricingPolicyValidationContext,
  type PricingPolicyValidationError,
  type PricingPolicyValidationResult,
  type PricingPolicyValidationWarning,
} from './pricing-policy.domain.js';

export {
  MAX_PRICING_POLICY_COMPONENT_LINES,
  MAX_PRICING_POLICY_SEARCH_STATES,
  PRICING_POLICY_RULE_SCHEMA_VERSION,
} from './pricing-policy.domain.js';
export type {
  DraftPricingPolicyAggregate,
  DraftPricingPolicyComponent,
  DraftPricingPolicyEdge,
  DraftPricingPolicyPrice,
  DraftPricingPolicyRoot,
  PublishedPricingPolicyRoot,
  PricingPolicyApplicabilityBasis,
  PricingPolicyBillingModel,
  PricingPolicyBoundaryPosition,
  PricingPolicyComponentKind,
  PricingPolicyCoverageModel,
  PricingPolicyJsonObject,
  PricingPolicyJsonValue,
  PricingPolicyStatus,
  PricingPolicyValidationContext,
  PricingPolicyValidationError,
  PricingPolicyValidationResult,
  PricingPolicyValidationWarning,
} from './pricing-policy.domain.js';

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function hasSeasonalTimezoneOffset(value: string): boolean {
  try {
    const instants = [
      new Date('2027-01-15T00:00:00.000Z'),
      new Date('2027-04-15T00:00:00.000Z'),
      new Date('2027-07-15T00:00:00.000Z'),
      new Date('2027-10-15T00:00:00.000Z'),
    ];
    const offsets = new Set(
      instants.map(
        (instant) =>
          new Intl.DateTimeFormat('en-US', { timeZone: value, timeZoneName: 'longOffset' })
            .formatToParts(instant)
            .find((part) => part.type === 'timeZoneName')?.value,
      ),
    );
    return offsets.size > 1;
  } catch {
    return true;
  }
}

function isJsonObject(value: unknown): value is PricingPolicyJsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => isJsonValue(entry));
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
  if (typeof value === 'object') return isJsonObject(value);
  return false;
}

function pushError(
  errors: PricingPolicyValidationError[],
  code: string,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

function pushWarning(
  warnings: PricingPolicyValidationWarning[],
  code: string,
  path: string,
  message: string,
): void {
  warnings.push({ code, path, message });
}

function validateCoverage(
  component: DraftPricingPolicyComponent,
  index: number,
  timezone: string,
  errors: PricingPolicyValidationError[],
): void {
  const path = `components[${index}]`;
  const onlyNull = (values: readonly (number | string | null)[]) =>
    values.every((value) => value === null);
  if (component.coverageModel === 'FIXED_ELAPSED') {
    if (
      component.fixedDurationMinutes === null ||
      component.fixedDurationMinutes < 15 ||
      component.fixedDurationMinutes > 44640 ||
      component.fixedDurationMinutes % 15 !== 0 ||
      !onlyNull([
        component.localStartMinuteInclusive,
        component.localEndMinuteExclusive,
        component.localEndDayOffset,
        component.boundaryPosition,
        component.boundaryMinDurationMinutes,
        component.boundaryMaxDurationMinutes,
      ])
    ) {
      pushError(errors, 'INVALID_COVERAGE_SHAPE', path, 'FIXED_ELAPSED has an invalid shape.');
    }
    return;
  }

  if (component.coverageModel === 'LOCAL_CLOCK_WINDOW') {
    if (hasSeasonalTimezoneOffset(timezone)) {
      pushError(
        errors,
        'DST_UNRESOLVED_LOCAL_CLOCK_WINDOW',
        path,
        'B0.2 rejects local-clock windows in seasonal-offset timezones until a dated wall-clock resolution policy is approved.',
      );
    }
    const valid =
      component.fixedDurationMinutes === null &&
      component.localStartMinuteInclusive !== null &&
      component.localEndMinuteExclusive !== null &&
      component.localEndDayOffset !== null &&
      component.localStartMinuteInclusive >= 0 &&
      component.localStartMinuteInclusive <= 1425 &&
      component.localStartMinuteInclusive % 15 === 0 &&
      component.localEndMinuteExclusive >= 15 &&
      component.localEndMinuteExclusive <= 1440 &&
      component.localEndMinuteExclusive % 15 === 0 &&
      (component.localEndDayOffset === 0 || component.localEndDayOffset === 1) &&
      component.localEndMinuteExclusive + component.localEndDayOffset * 1440 >
        component.localStartMinuteInclusive &&
      onlyNull([
        component.boundaryPosition,
        component.boundaryMinDurationMinutes,
        component.boundaryMaxDurationMinutes,
      ]);
    if (!valid)
      pushError(errors, 'INVALID_COVERAGE_SHAPE', path, 'LOCAL_CLOCK_WINDOW has an invalid shape.');
    return;
  }

  const valid =
    component.fixedDurationMinutes === null &&
    component.localStartMinuteInclusive === null &&
    component.localEndMinuteExclusive === null &&
    component.localEndDayOffset === null &&
    component.boundaryPosition !== null &&
    component.boundaryMinDurationMinutes !== null &&
    component.boundaryMaxDurationMinutes !== null &&
    component.boundaryMinDurationMinutes >= 15 &&
    component.boundaryMinDurationMinutes <= 44640 &&
    component.boundaryMinDurationMinutes % 15 === 0 &&
    component.boundaryMaxDurationMinutes >= component.boundaryMinDurationMinutes &&
    component.boundaryMaxDurationMinutes <= 44640 &&
    component.boundaryMaxDurationMinutes % 15 === 0 &&
    component.maximumOccurrencesPerCandidate === 1;
  if (!valid)
    pushError(errors, 'INVALID_COVERAGE_SHAPE', path, 'REQUEST_BOUNDARY has an invalid shape.');
}

function validateBilling(
  component: DraftPricingPolicyComponent,
  index: number,
  errors: PricingPolicyValidationError[],
): void {
  const path = `components[${index}]`;
  if (component.billingModel === 'FIXED_OCCURRENCE') {
    if (
      component.billingUnitMinutes !== null ||
      component.minimumBillingUnits !== null ||
      component.maximumBillingUnits !== null
    ) {
      pushError(
        errors,
        'INVALID_BILLING_SHAPE',
        path,
        'FIXED_OCCURRENCE cannot carry unit fields.',
      );
    }
    return;
  }
  const valid =
    component.billingUnitMinutes !== null &&
    component.billingUnitMinutes >= 15 &&
    component.billingUnitMinutes <= 44640 &&
    component.billingUnitMinutes % 15 === 0 &&
    (component.minimumBillingUnits === null || component.minimumBillingUnits > 0) &&
    (component.maximumBillingUnits === null || component.maximumBillingUnits > 0) &&
    (component.maximumBillingUnits === null ||
      component.minimumBillingUnits === null ||
      component.maximumBillingUnits >= component.minimumBillingUnits);
  if (!valid)
    pushError(errors, 'INVALID_BILLING_SHAPE', path, 'STARTED_UNIT has an invalid shape.');
}

function validateGraph(
  aggregate: DraftPricingPolicyAggregate,
  errors: PricingPolicyValidationError[],
): void {
  const components = new Map(aggregate.components.map((component) => [component.id, component]));
  const successors = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  const edgeKeys = new Set<string>();
  for (const component of aggregate.components) {
    successors.set(component.id, []);
    incoming.set(component.id, 0);
  }
  for (const [index, edge] of aggregate.edges.entries()) {
    const predecessor = components.get(edge.predecessorComponentId);
    const successor = components.get(edge.successorComponentId);
    if (predecessor === undefined || successor === undefined) {
      pushError(
        errors,
        'EDGE_COMPONENT_NOT_FOUND',
        `edges[${index}]`,
        'Edge endpoint is not in the same policy.',
      );
      continue;
    }
    const key = `${edge.predecessorComponentId}:${edge.successorComponentId}`;
    if (edgeKeys.has(key))
      pushError(errors, 'DUPLICATE_GRAPH_EDGE', `edges[${index}]`, 'Directed edge is duplicated.');
    edgeKeys.add(key);
    if (predecessor.id === successor.id) {
      if (predecessor.maximumOccurrencesPerCandidate <= 1) {
        pushError(
          errors,
          'UNBOUNDED_REPEAT',
          `edges[${index}]`,
          'A self-repeat requires a bound greater than one.',
        );
      }
    } else {
      successors.get(predecessor.id)?.push(successor.id);
      incoming.set(successor.id, (incoming.get(successor.id) ?? 0) + 1);
    }
    if (successor.boundaryPosition === 'LEADING') {
      pushError(
        errors,
        'INVALID_LEADING_PREDECESSOR',
        `edges[${index}]`,
        'LEADING cannot have a predecessor.',
      );
    }
    if (predecessor.boundaryPosition === 'TRAILING') {
      pushError(
        errors,
        'INVALID_TRAILING_SUCCESSOR',
        `edges[${index}]`,
        'TRAILING cannot have a successor.',
      );
    }
  }

  const roots = aggregate.components.filter((component) => (incoming.get(component.id) ?? 0) === 0);
  const reachable = new Set<string>();
  const visiting = new Set<string>();
  let exploredStates = 0;
  const visit = (id: string, path: readonly string[], lineCount: number): void => {
    exploredStates += 1;
    if (exploredStates > MAX_PRICING_POLICY_SEARCH_STATES) {
      pushError(
        errors,
        'MAXIMUM_SEARCH_STATE_EXCEEDED',
        'edges',
        'Graph search state bound was exceeded.',
      );
      return;
    }
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      const cycleLength = cycleStart < 0 ? 2 : path.length - cycleStart;
      if (cycleLength > 1)
        pushError(errors, 'MULTI_NODE_GRAPH_CYCLE', 'edges', 'Graph contains a multi-node cycle.');
      return;
    }
    const component = components.get(id);
    if (component === undefined) return;
    reachable.add(id);
    const nextLineCount = lineCount + Math.max(0, component.maximumOccurrencesPerCandidate - 1);
    if (nextLineCount > aggregate.root.maximumComponentLines) {
      pushError(
        errors,
        'MAXIMUM_SEARCH_STATE_EXCEEDED',
        `components.${id}`,
        'Graph repeat bound exceeds release line limit.',
      );
      return;
    }
    visiting.add(id);
    for (const successor of successors.get(id) ?? [])
      visit(successor, [...path, id], nextLineCount);
    visiting.delete(id);
  };
  for (const root of roots) visit(root.id, [], 1);
  for (const component of aggregate.components) {
    if (!reachable.has(component.id)) visit(component.id, [], 1);
  }
  for (const component of aggregate.components) {
    if (!reachable.has(component.id)) {
      pushError(
        errors,
        'UNREACHABLE_COMPONENT',
        `components.${component.id}`,
        'Component is not reachable from a graph root.',
      );
    }
  }
}

export function validatePricingPolicyAggregate(
  aggregate: DraftPricingPolicyAggregate,
  context: PricingPolicyValidationContext,
): PricingPolicyValidationResult {
  const errors: PricingPolicyValidationError[] = [];
  const warnings: PricingPolicyValidationWarning[] = [];
  const root = aggregate.root;

  if (root.status !== 'DRAFT')
    pushError(errors, 'POLICY_NOT_DRAFT', 'root.status', 'Only DRAFT policies can be published.');
  if (root.propertyId !== context.propertyId)
    pushError(
      errors,
      'PROPERTY_MISMATCH',
      'root.propertyId',
      'Policy property does not match server property context.',
    );
  if (root.timezoneSnapshot !== context.propertyTimezone) {
    pushError(
      errors,
      'TIMEZONE_SNAPSHOT_MISMATCH',
      'root.timezoneSnapshot',
      'Policy timezone must equal the server property timezone.',
    );
  }
  if (!isValidTimezone(root.timezoneSnapshot))
    pushError(
      errors,
      'INVALID_TIMEZONE',
      'root.timezoneSnapshot',
      'Policy timezone is not a valid IANA timezone.',
    );
  if (root.internalName.trim().length === 0 || root.internalName.length > 200)
    pushError(
      errors,
      'INVALID_POLICY_NAME',
      'root.internalName',
      'Policy name must be 1-200 characters.',
    );
  if (root.versionNumber <= 0n)
    pushError(errors, 'INVALID_VERSION', 'root.versionNumber', 'Version number must be positive.');
  if (!isValidDate(root.effectiveFrom))
    pushError(
      errors,
      'INVALID_EFFECTIVE_FROM',
      'root.effectiveFrom',
      'effectiveFrom must be a valid instant.',
    );
  if (
    root.effectiveUntil !== null &&
    (!isValidDate(root.effectiveUntil) || root.effectiveUntil <= root.effectiveFrom)
  ) {
    pushError(
      errors,
      'INVALID_EFFECTIVE_INTERVAL',
      'root.effectiveUntil',
      'effectiveUntil must be after effectiveFrom.',
    );
  }
  if (root.ruleSchemaVersion !== PRICING_POLICY_RULE_SCHEMA_VERSION)
    pushError(
      errors,
      'UNSUPPORTED_RULE_SCHEMA',
      'root.ruleSchemaVersion',
      'Rule schema version is not supported by B0.2.',
    );
  if (
    root.maximumComponentLines < 1 ||
    root.maximumComponentLines > MAX_PRICING_POLICY_COMPONENT_LINES
  )
    pushError(
      errors,
      'INVALID_COMPONENT_LIMIT',
      'root.maximumComponentLines',
      'Component line limit is outside the approved bound.',
    );
  if (
    context.establishedBasis !== undefined &&
    root.applicabilityBasis !== context.establishedBasis
  ) {
    pushError(
      errors,
      'PROPERTY_BASIS_MISMATCH',
      'root.applicabilityBasis',
      'Policy basis differs from the property lineage basis.',
    );
  }
  if (aggregate.components.length === 0 || aggregate.components.length > root.maximumComponentLines)
    pushError(
      errors,
      'INVALID_COMPONENT_COUNT',
      'components',
      'Component count must be within the release bound.',
    );

  const componentIds = new Set<string>();
  const componentCodes = new Set<string>();
  for (const [index, component] of aggregate.components.entries()) {
    if (componentIds.has(component.id))
      pushError(
        errors,
        'DUPLICATE_COMPONENT_ID',
        `components[${index}].id`,
        'Component id is duplicated.',
      );
    componentIds.add(component.id);
    if (componentCodes.has(component.componentCode))
      pushError(
        errors,
        'DUPLICATE_COMPONENT_CODE',
        `components[${index}].componentCode`,
        'Component code is duplicated.',
      );
    componentCodes.add(component.componentCode);
    if (component.policyVersionId !== root.id)
      pushError(
        errors,
        'COMPONENT_POLICY_MISMATCH',
        `components[${index}].policyVersionId`,
        'Component belongs to another policy.',
      );
    if (!/^[A-Z0-9_]{1,64}$/.test(component.componentCode))
      pushError(
        errors,
        'INVALID_COMPONENT_CODE',
        `components[${index}].componentCode`,
        'Component code must be uppercase and bounded.',
      );
    if (
      component.maximumOccurrencesPerCandidate < 1 ||
      component.maximumOccurrencesPerCandidate > 64
    )
      pushError(
        errors,
        'INVALID_OCCURRENCE_BOUND',
        `components[${index}]`,
        'Occurrence bound must be between one and sixty-four.',
      );
    if (
      component.conditionComplexityRank < 0 ||
      component.conditionComplexityRank > 1000 ||
      component.tieBreakRank < 0 ||
      component.tieBreakRank > 1_000_000
    )
      pushError(
        errors,
        'INVALID_COMPONENT_RANK',
        `components[${index}]`,
        'Component ranking is outside the approved bound.',
      );
    if (
      !isJsonObject(component.restrictionMetadata) ||
      !isJsonObject(component.displayMetadata) ||
      (component.legacyProvenance !== null && !isJsonObject(component.legacyProvenance))
    )
      pushError(
        errors,
        'INVALID_COMPONENT_METADATA',
        `components[${index}]`,
        'Component metadata must be JSON objects.',
      );
    validateCoverage(component, index, root.timezoneSnapshot, errors);
    validateBilling(component, index, errors);
  }

  const priceKeys = new Set<string>();
  const pricesByComponent = new Map<string, Set<string>>();
  for (const [index, price] of aggregate.prices.entries()) {
    const path = `prices[${index}]`;
    if (
      price.propertyId !== root.propertyId ||
      price.policyVersionId !== root.id ||
      !componentIds.has(price.componentId)
    )
      pushError(
        errors,
        'PRICE_OWNERSHIP_MISMATCH',
        path,
        'Price must belong to the same property, policy, and component.',
      );
    if (!context.priceTierIds.has(price.priceTierId))
      pushError(
        errors,
        'UNKNOWN_PRICE_TIER',
        path,
        'Price tier is not owned by the server property.',
      );
    if (price.amountVnd <= 0n)
      pushError(
        errors,
        'INVALID_PRICE_AMOUNT',
        path,
        'Price amount must be a positive integer VND amount.',
      );
    const key = `${price.componentId}:${price.priceTierId}`;
    if (priceKeys.has(key))
      pushError(errors, 'DUPLICATE_COMPONENT_PRICE', path, 'Component price tier is duplicated.');
    priceKeys.add(key);
    const tierSet = pricesByComponent.get(price.componentId) ?? new Set<string>();
    tierSet.add(price.priceTierId);
    pricesByComponent.set(price.componentId, tierSet);
  }
  if (context.requiredPriceTierIds !== undefined) {
    for (const component of aggregate.components) {
      for (const requiredTierId of context.requiredPriceTierIds) {
        if (!(pricesByComponent.get(component.id)?.has(requiredTierId) ?? false))
          pushError(
            errors,
            'MISSING_COMPONENT_PRICE',
            `components.${component.id}.prices`,
            'Every approved component must have a price for every required tier.',
          );
      }
    }
  }
  validateGraph(aggregate, errors);

  if (root.applicabilityBasis === 'QUOTE_INSTANT')
    pushWarning(
      warnings,
      'BASIS_REQUIRES_EXPLICIT_INSTANT',
      'root.applicabilityBasis',
      'Lookup must receive a server-owned quote instant.',
    );
  if (root.applicabilityBasis === 'STAY_START')
    pushWarning(
      warnings,
      'BASIS_REQUIRES_SERVER_STAY_START',
      'root.applicabilityBasis',
      'Lookup must receive a server-owned stay start.',
    );

  const normalized: DraftPricingPolicyAggregate = {
    root: { ...root, internalName: root.internalName.trim() },
    components: [...aggregate.components]
      .sort(
        (left, right) =>
          left.componentCode.localeCompare(right.componentCode) || left.id.localeCompare(right.id),
      )
      .map((component) => ({ ...component })),
    prices: [...aggregate.prices]
      .sort(
        (left, right) =>
          left.componentId.localeCompare(right.componentId) ||
          left.priceTierId.localeCompare(right.priceTierId) ||
          left.id.localeCompare(right.id),
      )
      .map((price) => ({ ...price })),
    edges: [...aggregate.edges]
      .sort(
        (left, right) =>
          left.predecessorComponentId.localeCompare(right.predecessorComponentId) ||
          left.successorComponentId.localeCompare(right.successorComponentId) ||
          left.id.localeCompare(right.id),
      )
      .map((edge) => ({ ...edge })),
  };
  if (errors.length > 0) {
    return {
      errors,
      warnings,
      publicationReady: false,
    };
  }
  return {
    errors,
    warnings,
    publicationReady: true,
    normalized,
  };
}
