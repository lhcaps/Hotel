import {
  customerProfiles,
  type DatabaseClient,
  eq,
  sql,
  users,
} from '@room/database';

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
