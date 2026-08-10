import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { type DatabaseClient } from '@room/database';

import type { ActorContext } from '../auth/actor-context.js';

export interface CurrentProperty {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
}

/**
 * Legacy actor-blind error, retained for the small number of public/customer
 * call sites that intentionally have no actor and no authorization boundary
 * (see PublicPropertyContextService below). Not used by the actor-aware
 * resolver.
 */
export class PropertyContextError extends Error {
  public readonly code = 'PROPERTY_NOT_FOUND';
  public constructor() {
    super('No active property is configured.');
    this.name = 'PropertyContextError';
  }
}

/**
 * Pure authorization arbitration (ORIG-F-002, ORIG-F-003). Given the set of
 * currently ACTIVE properties (queried by the caller, possibly bound to an
 * in-flight transaction) and the actor's server-derived `propertyIds`,
 * decides exactly one authorized property or throws. This is the single
 * canonical implementation of "which property" — every repository-local
 * `getCurrentProperty()` calls through this function instead of
 * re-implementing selection. See
 * docs/stabilization/W6_MULTI_PROPERTY_IMPLEMENTATION_DESIGN.md section 5.
 *
 * Client-supplied propertyId is a selector only. It never grants authority:
 * a requested id outside the actor's authorized set is rejected before any
 * row lookup, so there is no cross-property existence leakage.
 */
export function resolveAuthorizedProperty<T extends { readonly id: string }>(
  actor: Pick<ActorContext, 'propertyIds'>,
  activeProperties: readonly T[],
  requestedPropertyId?: string,
): T {
  // undefined/omitted is treated identically to an empty array (deny) — see
  // ActorContext.propertyIds doc comment.
  const propertyIds = actor.propertyIds ?? [];

  // Zero-property actor: an admin profile with no property authorization at
  // all. Deny before any candidate-set logic (task requirement: "zero-
  // property actor -> denied").
  if (propertyIds !== 'ALL' && propertyIds.length === 0) {
    throw new ForbiddenException({ code: 'PROPERTY_ACCESS_DENIED' });
  }

  if (requestedPropertyId !== undefined) {
    // Hostile UUID substitution: the actor asked for a specific property
    // that is not in their authorized set. Deny before any row lookup.
    if (propertyIds !== 'ALL' && !propertyIds.includes(requestedPropertyId)) {
      throw new ForbiddenException({ code: 'PROPERTY_ACCESS_DENIED' });
    }
    const property = activeProperties.find((candidate) => candidate.id === requestedPropertyId);
    if (property === undefined) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND' });
    }
    return property;
  }

  // No explicit selector: resolve safely only when the actor's authorized
  // set intersected with the currently ACTIVE properties is exactly one
  // property. Never silently pick "the first active property" for a
  // multi-property actor.
  const activeCandidates =
    propertyIds === 'ALL'
      ? activeProperties
      : activeProperties.filter((candidate) => propertyIds.includes(candidate.id));

  if (activeCandidates.length === 0) {
    throw new PropertyContextError();
  }
  if (activeCandidates.length > 1) {
    throw new ConflictException({ code: 'PROPERTY_CONTEXT_REQUIRED' });
  }
  const [resolved] = activeCandidates;
  if (resolved === undefined) {
    throw new PropertyContextError();
  }
  return resolved;
}

/**
 * Server-derived, permission-checked property context resolution for
 * controller-level call sites that are not already inside a repository
 * transaction. Queries the currently ACTIVE properties directly and
 * arbitrates with `resolveAuthorizedProperty`.
 */
export class PropertyContextService {
  public constructor(private readonly client: DatabaseClient) {}

  public async getCurrent(
    actor: ActorContext,
    requestedPropertyId?: string,
  ): Promise<CurrentProperty> {
    const activeProperties = await this.client.query.properties.findMany({
      where: (fields, { eq }) => eq(fields.status, 'ACTIVE'),
      orderBy: (fields, { asc }) => [asc(fields.createdAt), asc(fields.id)],
    });
    const property = resolveAuthorizedProperty(actor, activeProperties, requestedPropertyId);
    return {
      id: property.id,
      code: property.code,
      name: property.name,
      timezone: property.timezone,
    };
  }
}

/**
 * Public/customer-facing surfaces (search, quote, booking creation, public
 * catalog) have no admin actor and no authorization boundary to enforce —
 * per design section 5, these remain B0-single-active-property, unchanged.
 * Kept as a distinct, explicitly-named type so it is never accidentally
 * substituted for the actor-aware admin resolver above.
 */
export class PublicPropertyContextService {
  public constructor(private readonly client: DatabaseClient) {}

  public async getCurrent(): Promise<CurrentProperty> {
    const row = await this.client.query.properties.findFirst({
      where: (fields, { eq }) => eq(fields.status, 'ACTIVE'),
      orderBy: (fields, { asc }) => asc(fields.createdAt),
    });
    if (row === undefined) {
      throw new PropertyContextError();
    }
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
    };
  }
}
