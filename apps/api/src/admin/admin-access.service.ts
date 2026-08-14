import {
  adminAccountPatchSchema,
  adminAccountCreateSchema,
  adminAccountSchema,
  adminAuditResponseSchema,
  adminCustomerAccountPatchSchema,
  adminCustomerAccountSchema,
  adminDepartmentCommandSchema,
  adminDepartmentSchema,
  propertySchema,
} from '@room/contracts';
import {
  accounts,
  and,
  adminDepartments,
  adminMemberships,
  adminPropertyMemberships,
  auditEvents,
  bookings,
  eq,
  inArray,
  sessions,
  sql,
  users,
  type DatabaseClient,
} from '@room/database';
import {
  ADMIN_PROFILE_LABELS_VI,
  createAuthAdminUser,
  type AdminProfileCode,
  type createRoomAuth,
} from '@room/auth';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';

type AdminDatabase = Pick<
  DatabaseClient,
  'delete' | 'insert' | 'query' | 'select' | 'update' | 'transaction'
>;

const ADMIN_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'ROOM_STATUS_VIEWER',
  'OPERATIONS_MANAGER',
  'HOUSEKEEPING_MANAGER',
  'HOUSEKEEPING_STAFF',
  'PAYMENT_STAFF',
  'MAINTENANCE_MANAGER',
  'MAINTENANCE_STAFF',
  'STAFF_MANAGER',
] as const;
const ADMIN_PROFILE_RANK: Readonly<Record<AdminProfileCode, number>> = {
  ROOM_STATUS_VIEWER: 1,
  HOUSEKEEPING_STAFF: 2,
  MAINTENANCE_STAFF: 3,
  PAYMENT_STAFF: 4,
  HOUSEKEEPING_MANAGER: 5,
  MAINTENANCE_MANAGER: 6,
  STAFF_MANAGER: 7,
  OPERATIONS_MANAGER: 8,
  SUPER_ADMIN: 9,
};

function isAdminRole(value: string): value is (typeof ADMIN_ROLES)[number] {
  return ADMIN_ROLES.includes(value as (typeof ADMIN_ROLES)[number]);
}

function isAdminProfile(value: string): value is AdminProfileCode {
  return (
    value === 'SUPER_ADMIN' ||
    value === 'ROOM_STATUS_VIEWER' ||
    value === 'OPERATIONS_MANAGER' ||
    value === 'HOUSEKEEPING_MANAGER' ||
    value === 'HOUSEKEEPING_STAFF' ||
    value === 'PAYMENT_STAFF' ||
    value === 'MAINTENANCE_MANAGER' ||
    value === 'MAINTENANCE_STAFF' ||
    value === 'STAFF_MANAGER'
  );
}

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local.at(-1)}@${domain}`;
}

function toIso(value: Date | string | null | undefined): string | null {
  return value === null || value === undefined ? null : new Date(value).toISOString();
}

export class AdminAccessService {
  public constructor(
    private readonly database: AdminDatabase,
    private readonly auth?: ReturnType<typeof createRoomAuth>,
  ) {}

  public async listAccounts(actor: ActorContext) {
    const rows = await this.database.query.users.findMany({
      where: (fields, { or, eq }) =>
        or(
          eq(fields.role, 'ADMIN'),
          eq(fields.role, 'SUPER_ADMIN'),
          eq(fields.role, 'ROOM_STATUS_VIEWER'),
        ),
      orderBy: (fields, { asc }) => [asc(fields.email), asc(fields.id)],
    });
    const items = await Promise.all(rows.map((row) => this.account(row)));
    return items
      .filter((item) => this.canReadAccount(actor, item))
      .map((item) => adminAccountSchema.parse(item));
  }

  public async listAssignableProperties(actor: ActorContext) {
    if (actor.profileCode !== 'SUPER_ADMIN') {
      throw new BadRequestException({ code: 'SUPER_ADMIN_REQUIRED' });
    }
    const rows = await this.database.query.properties.findMany({
      where: (fields, { eq }) => eq(fields.status, 'ACTIVE'),
      orderBy: (fields, { asc }) => [asc(fields.name), asc(fields.id)],
    });
    return rows.map((row) =>
      propertySchema.parse({
        ...row,
        currency: 'VND',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    );
  }

  public async updateAccount(actor: ActorContext, id: string, input: unknown) {
    const patch = adminAccountPatchSchema.parse(input);
    if (actor.userId === id && patch.status === 'DISABLED') {
      throw new BadRequestException({ code: 'SELF_DISABLE_FORBIDDEN' });
    }
    if (actor.userId === id && patch.role !== undefined) {
      throw new BadRequestException({ code: 'SELF_PROFILE_CHANGE_FORBIDDEN' });
    }
    if (actor.userId === id && patch.departmentIds !== undefined) {
      throw new BadRequestException({ code: 'SELF_MEMBERSHIP_CHANGE_FORBIDDEN' });
    }
    if (actor.userId === id && patch.propertyIds !== undefined) {
      throw new BadRequestException({ code: 'SELF_PROPERTY_SCOPE_CHANGE_FORBIDDEN' });
    }
    const target = await this.database.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
    });
    if (target === undefined || !isAdminRole(target.role)) {
      throw new NotFoundException({ code: 'ADMIN_ACCOUNT_NOT_FOUND' });
    }

    // Get target's current profile from adminMemberships
    const targetMemberships = await this.database.query.adminMemberships.findMany({
      where: (fields, { and, eq }) => and(eq(fields.userId, id), eq(fields.status, 'ACTIVE')),
    });
    const targetProfileCode =
      targetMemberships
        .map((membership) => membership.role)
        .filter((role): role is AdminProfileCode => isAdminProfile(role))
        .sort((left, right) => ADMIN_PROFILE_RANK[right] - ADMIN_PROFILE_RANK[left])[0] ?? null;

    if (target.role === 'SUPER_ADMIN' && actor.profileCode !== 'SUPER_ADMIN') {
      throw new BadRequestException({ code: 'SUPER_ADMIN_TARGET_FORBIDDEN' });
    }

    // STAFF_MANAGER constraints (check early before other validations)
    if (actor.profileCode === 'STAFF_MANAGER') {
      // Prevent self-modification
      if (id === actor.userId) {
        throw new BadRequestException({ code: 'SELF_MEMBERSHIP_CHANGE_FORBIDDEN' });
      }
      if (patch.role === 'SUPER_ADMIN' || targetProfileCode === 'SUPER_ADMIN') {
        throw new BadRequestException({ code: 'STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN' });
      }

      const allowedProfiles: ReadonlySet<AdminProfileCode> = new Set([
        'ROOM_STATUS_VIEWER',
        'HOUSEKEEPING_MANAGER',
        'HOUSEKEEPING_STAFF',
        'PAYMENT_STAFF',
        'MAINTENANCE_MANAGER',
        'MAINTENANCE_STAFF',
      ]);

      if (patch.role !== undefined) {
        if (patch.role === 'STAFF_MANAGER') {
          throw new BadRequestException({ code: 'STAFF_MANAGER_GRANT_SELF_FORBIDDEN' });
        }
        if (patch.role === 'OPERATIONS_MANAGER') {
          throw new BadRequestException({ code: 'STAFF_MANAGER_ESCALATION_FORBIDDEN' });
        }
        if (!allowedProfiles.has(patch.role as AdminProfileCode)) {
          throw new BadRequestException({ code: 'STAFF_MANAGER_PROFILE_NOT_DELEGABLE' });
        }
      } else {
        // When not changing role, check if target's current profile is manageable
        if (targetProfileCode && !allowedProfiles.has(targetProfileCode)) {
          throw new BadRequestException({ code: 'STAFF_MANAGER_PROFILE_NOT_DELEGABLE' });
        }
      }
      if (patch.propertyIds !== undefined) {
        throw new BadRequestException({ code: 'STAFF_MANAGER_PROPERTY_GRANT_FORBIDDEN' });
      }

      // Property scope enforcement: STAFF_MANAGER can only manage staff within their authorized properties
      const targetPropertyMemberships = await this.database.query.adminPropertyMemberships.findMany(
        {
          where: (fields, { and, eq }) => and(eq(fields.userId, id), eq(fields.status, 'ACTIVE')),
          columns: { propertyId: true },
        },
      );
      const targetPropertyIds = new Set(
        targetPropertyMemberships
          .map((membership) => membership.propertyId)
          .filter((propertyId): propertyId is string => propertyId !== null),
      );
      const actorPropertyIds = actor.propertyIds;

      // A global profile/status/session mutation must not affect a staff member
      // who remains active in a property outside the manager's scope. Historical
      // REVOKED rows are deliberately excluded above.
      if (
        actorPropertyIds === 'ALL' ||
        actorPropertyIds === undefined ||
        targetPropertyIds.size === 0 ||
        [...targetPropertyIds].some((propertyId) => !actorPropertyIds.includes(propertyId))
      ) {
        throw new BadRequestException({ code: 'STAFF_MANAGER_PROPERTY_SCOPE_VIOLATION' });
      }
    }

    const role =
      patch.role ?? targetProfileCode ?? (isAdminProfile(target.role) ? target.role : null);
    await this.assertSuperAdminRemainsActive(target, targetProfileCode, patch);
    if (patch.propertyIds !== undefined && role === 'SUPER_ADMIN') {
      throw new BadRequestException({ code: 'SUPER_ADMIN_PROPERTY_SCOPE_IMPLICIT' });
    }
    if (patch.propertyIds !== undefined) {
      await this.assertActivePropertyIds(patch.propertyIds);
    }
    if (patch.role === undefined && target.role === 'ADMIN' && patch.departmentIds !== undefined) {
      throw new BadRequestException({ code: 'ADMIN_PROFILE_REQUIRED' });
    }
    if (role === null) {
      if (patch.role !== undefined) {
        throw new BadRequestException({ code: 'ADMIN_PROFILE_REQUIRED' });
      }
      if (patch.departmentIds !== undefined) {
        throw new BadRequestException({ code: 'ADMIN_PROFILE_REQUIRED' });
      }
    }
    if (target.role === 'ADMIN' && patch.role !== undefined && patch.departmentIds === undefined) {
      throw new BadRequestException({ code: 'DEPARTMENT_REQUIRED' });
    }
    if (patch.departmentIds?.some((departmentId) => departmentId.trim() === '')) {
      throw new BadRequestException({ code: 'INVALID_DEPARTMENT_ID' });
    }
    await this.database.transaction(async (transaction) => {
      // users.role only supports base auth roles. Profile-specific codes live in adminMemberships.
      const baseUserRole: 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER' | 'ADMIN' =
        role === 'SUPER_ADMIN' || role === 'ROOM_STATUS_VIEWER'
          ? role
          : role === null
            ? target.role === 'ADMIN' ||
              target.role === 'SUPER_ADMIN' ||
              target.role === 'ROOM_STATUS_VIEWER'
              ? target.role
              : 'ADMIN'
            : 'ADMIN';
      await transaction
        .update(users)
        .set({
          role: baseUserRole,
          status: patch.status ?? target.status,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
      if (patch.departmentIds !== undefined) {
        await transaction.delete(adminMemberships).where(eq(adminMemberships.userId, id));
        if (patch.departmentIds.length > 0) {
          await transaction.insert(adminMemberships).values(
            patch.departmentIds.map((departmentId) => ({
              userId: id,
              departmentId,
              role: role as AdminProfileCode,
            })),
          );
        }
      } else if (patch.role !== undefined) {
        await transaction
          .update(adminMemberships)
          .set({ role: patch.role as AdminProfileCode, updatedAt: new Date() })
          .where(eq(adminMemberships.userId, id));
      }
      if (patch.propertyIds !== undefined) {
        await transaction
          .update(adminPropertyMemberships)
          .set({ status: 'REVOKED', revokedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(adminPropertyMemberships.userId, id),
              eq(adminPropertyMemberships.status, 'ACTIVE'),
            ),
          );
        await transaction.insert(adminPropertyMemberships).values(
          patch.propertyIds.map((propertyId) => ({
            userId: id,
            propertyId,
            status: 'ACTIVE' as const,
          })),
        );
      }
      await this.writeAudit(transaction, actor, id, 'ADMIN_ACCOUNT_UPDATED', {
        status: patch.status ?? target.status,
        role: role ?? target.role,
        departmentIds: patch.departmentIds ?? null,
        propertyIds: patch.propertyIds ?? null,
      });
    });
    return this.accountById(id);
  }

  public async listCustomerAccounts(actor: ActorContext) {
    this.requireSuperAdmin(actor);
    const rows = await this.database
      .select({
        id: users.id,
        displayName: users.name,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        bookingCount: sql<number>`count(distinct ${bookings.id})::int`,
        activeSessionCount: sql<number>`count(distinct ${sessions.id}) filter (where ${sessions.expiresAt} > now())::int`,
        lastActivityAt: sql<Date | null>`max(${sessions.updatedAt})`,
        providers: sql<
          string[]
        >`coalesce(array_agg(distinct ${accounts.providerId}) filter (where ${accounts.providerId} is not null), ARRAY[]::text[])`,
      })
      .from(users)
      .leftJoin(accounts, eq(accounts.userId, users.id))
      .leftJoin(bookings, eq(bookings.customerUserId, users.id))
      .leftJoin(sessions, eq(sessions.userId, users.id))
      .where(eq(users.role, 'CUSTOMER'))
      .groupBy(users.id, users.email, users.status, users.createdAt)
      .orderBy(sql`lower(${users.email})`, users.id);

    return rows.map((row) =>
      adminCustomerAccountSchema.parse({
        id: row.id,
        displayName: row.displayName,
        emailMasked: maskEmail(row.email),
        providers: row.providers,
        status: row.status,
        bookingCount: row.bookingCount,
        activeSessionCount: row.activeSessionCount,
        lastActivityAt: toIso(row.lastActivityAt),
        createdAt: new Date(row.createdAt).toISOString(),
      }),
    );
  }

  public async createAccount(actor: ActorContext, input: unknown) {
    if (actor.profileCode !== 'SUPER_ADMIN') {
      throw new BadRequestException({ code: 'SUPER_ADMIN_REQUIRED' });
    }
    const command = adminAccountCreateSchema.parse(input);
    if (this.auth === undefined) {
      throw new BadRequestException({ code: 'AUTH_ACCOUNT_CREATION_UNAVAILABLE' });
    }
    if (command.departmentIds.length > 0) {
      const departments = await this.database.query.adminDepartments.findMany({
        where: (fields, { and, eq }) =>
          and(eq(fields.status, 'ACTIVE'), inArray(fields.id, command.departmentIds)),
        columns: { id: true },
      });
      if (departments.length !== command.departmentIds.length) {
        throw new BadRequestException({ code: 'DEPARTMENT_NOT_FOUND' });
      }
    }
    if (command.role !== 'SUPER_ADMIN' && command.propertyIds === undefined) {
      throw new BadRequestException({ code: 'PROPERTY_SCOPE_REQUIRED' });
    }
    if (command.role === 'SUPER_ADMIN' && command.propertyIds !== undefined) {
      throw new BadRequestException({ code: 'SUPER_ADMIN_PROPERTY_SCOPE_IMPLICIT' });
    }
    if (command.propertyIds !== undefined) {
      await this.assertActivePropertyIds(command.propertyIds);
    }
    const existing = await this.database.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.email, command.email.toLocaleLowerCase('en-US')),
      columns: { id: true },
    });
    if (existing !== undefined) {
      throw new ConflictException({ code: 'ADMIN_EMAIL_CONFLICT' });
    }
    const auth = this.auth;
    if (auth === undefined) {
      throw new BadRequestException({ code: 'AUTH_ACCOUNT_CREATION_UNAVAILABLE' });
    }
    const created = await (async () => {
      try {
        return await createAuthAdminUser(auth, {
          email: command.email,
          name: command.displayName,
          password: command.password,
          // Users table only supports base auth roles; profile codes live in memberships
          role:
            command.role === 'SUPER_ADMIN' || command.role === 'ROOM_STATUS_VIEWER'
              ? command.role
              : 'ROOM_STATUS_VIEWER',
        });
      } catch (cause) {
        // Best-effort rollback so the user account created by Better Auth does not
        // become an orphan if a downstream insert (department/property membership)
        // or audit write fails.
        const errorCode =
          typeof cause === 'object' &&
          cause !== null &&
          'code' in cause &&
          typeof (cause as { readonly code?: unknown }).code === 'string'
            ? (cause as { readonly code: string }).code
            : undefined;
        if (
          (errorCode === undefined ||
            errorCode === 'USER_ALREADY_EXISTS' ||
            errorCode === 'USER_EMAIL_ALREADY_EXISTS' ||
            errorCode === 'EMAIL_ALREADY_EXISTS') &&
          existing === undefined
        ) {
          // Re-check whether the cause is a duplicate email — race with another
          // concurrent creation. Better Auth may also surface raw driver errors.
          const racer = await this.database.query.users.findFirst({
            where: (fields, { eq }) => eq(fields.email, command.email.toLocaleLowerCase('en-US')),
            columns: { id: true },
          });
          if (racer !== undefined) {
            throw new ConflictException({ code: 'ADMIN_EMAIL_CONFLICT' });
          }
        }
        if (errorCode === 'INVALID_EMAIL' || errorCode === 'INVALID_PASSWORD') {
          throw new BadRequestException({ code: errorCode });
        }
        throw new BadRequestException({ code: 'AUTH_ACCOUNT_CREATION_FAILED' });
      }
    })();
    try {
      await this.database.transaction(async (transaction) => {
        if (command.departmentIds.length > 0) {
          await transaction.insert(adminMemberships).values(
            command.departmentIds.map((departmentId) => ({
              userId: created.id,
              departmentId,
              role: command.role,
            })),
          );
        }
        if (command.propertyIds !== undefined) {
          await transaction.insert(adminPropertyMemberships).values(
            command.propertyIds.map((propertyId) => ({
              userId: created.id,
              propertyId,
              status: 'ACTIVE' as const,
            })),
          );
        }
        await this.writeAudit(transaction, actor, created.id, 'ADMIN_ACCOUNT_CREATED', {
          role: command.role,
          departmentIds: command.departmentIds,
          propertyIds: command.propertyIds ?? [],
        });
      });
    } catch (cause) {
      // Compensate: remove the orphan user we just created via Better Auth so
      // a downstream membership failure does not leave an un-bootstrapped
      // account in the system.
      try {
        await this.database.delete(users).where(eq(users.id, created.id));
        await this.database.delete(sessions).where(eq(sessions.userId, created.id));
        await this.database.delete(accounts).where(eq(accounts.userId, created.id));
      } catch {
        // Best-effort cleanup; surface the original failure to the caller.
      }
      throw cause;
    }
    return this.accountById(created.id);
  }

  public async updateCustomerAccount(actor: ActorContext, id: string, input: unknown) {
    this.requireSuperAdmin(actor);
    const patch = adminCustomerAccountPatchSchema.parse(input);
    const target = await this.database.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
      columns: { id: true, role: true },
    });
    if (target === undefined || target.role !== 'CUSTOMER') {
      throw new NotFoundException({ code: 'CUSTOMER_ACCOUNT_NOT_FOUND' });
    }
    await this.database
      .update(users)
      .set({ status: patch.status, updatedAt: new Date() })
      .where(eq(users.id, id));
    await this.writeAudit(this.database, actor, id, 'CUSTOMER_ACCOUNT_UPDATED', {
      status: patch.status,
    });
    const updated = (await this.listCustomerAccounts(actor)).find((item) => item.id === id);
    if (updated === undefined) throw new NotFoundException({ code: 'CUSTOMER_ACCOUNT_NOT_FOUND' });
    return updated;
  }

  public async revokeCustomerSessions(actor: ActorContext, id: string) {
    this.requireSuperAdmin(actor);
    const target = await this.database.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
      columns: { id: true, role: true },
    });
    if (target === undefined || target.role !== 'CUSTOMER') {
      throw new NotFoundException({ code: 'CUSTOMER_ACCOUNT_NOT_FOUND' });
    }
    const deleted = await this.database.delete(sessions).where(eq(sessions.userId, id));
    const revoked = deleted.rowCount ?? 0;
    await this.writeAudit(this.database, actor, id, 'CUSTOMER_SESSIONS_REVOKED', { revoked });
    return { userId: id, revokedSessions: revoked };
  }

  public async revokeSessions(actor: ActorContext, id: string) {
    const target = await this.database.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
      columns: { id: true, role: true },
    });
    if (target === undefined || !isAdminRole(target.role)) {
      throw new NotFoundException({ code: 'ADMIN_ACCOUNT_NOT_FOUND' });
    }
    await this.assertAdminTargetInScope(actor, id);
    const deleted = await this.database.delete(sessions).where(eq(sessions.userId, id));
    const revoked = deleted.rowCount ?? 0;
    await this.writeAudit(this.database, actor, id, 'ADMIN_SESSIONS_REVOKED', { revoked });
    return { userId: id, revokedSessions: revoked };
  }

  public async listDepartments() {
    const rows = await this.database.query.adminDepartments.findMany({
      orderBy: (fields, { asc }) => [asc(fields.name), asc(fields.id)],
    });
    return Promise.all(
      rows.map(async (row) => {
        const members = await this.database.query.adminMemberships.findMany({
          where: (fields, { and, eq }) =>
            and(eq(fields.departmentId, row.id), eq(fields.status, 'ACTIVE')),
          columns: { id: true },
        });
        return adminDepartmentSchema.parse({
          id: row.id,
          code: row.code,
          name: row.name,
          status: row.status,
          memberCount: members.length,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        });
      }),
    );
  }

  public async createDepartment(actor: ActorContext, input: unknown) {
    this.requireSuperAdmin(actor);
    const command = adminDepartmentCommandSchema.parse(input);
    const code = command.code.toUpperCase();
    try {
      const [created] = await this.database
        .insert(adminDepartments)
        .values({ code, name: command.name })
        .returning();
      if (created === undefined) throw new ConflictException({ code: 'DEPARTMENT_CREATE_FAILED' });
      await this.writeAudit(this.database, actor, created.id, 'ADMIN_DEPARTMENT_CREATED', {
        code,
        name: command.name,
      });
      return adminDepartmentSchema.parse({
        id: created.id,
        code: created.code,
        name: created.name,
        status: created.status,
        memberCount: 0,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException({ code: 'DEPARTMENT_CODE_CONFLICT' });
    }
  }

  public async listAudit(actor: ActorContext) {
    this.requireSuperAdmin(actor);
    const rows = await this.database
      .select({
        id: auditEvents.id,
        eventType: auditEvents.eventType,
        actorId: auditEvents.actorId,
        actorName: users.name,
        aggregateType: auditEvents.aggregateType,
        aggregateId: auditEvents.aggregateId,
        payload: auditEvents.payload,
        occurredAt: auditEvents.occurredAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(sql`${auditEvents.eventType} LIKE 'ADMIN_%'`)
      .orderBy(sql`${auditEvents.occurredAt} DESC`)
      .limit(100);
    return adminAuditResponseSchema.parse({
      items: rows.map((row) => ({
        ...row,
        payload: row.payload as Record<string, unknown>,
        occurredAt: row.occurredAt.toISOString(),
      })),
    });
  }

  private async accountById(id: string) {
    const row = await this.database.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
    });
    if (row === undefined) throw new NotFoundException({ code: 'ADMIN_ACCOUNT_NOT_FOUND' });
    return adminAccountSchema.parse(await this.account(row));
  }

  private canReadAccount(
    actor: ActorContext,
    account: {
      readonly id: string;
      readonly profileCode: AdminProfileCode | null;
      readonly propertyIds: readonly string[];
    },
  ): boolean {
    if (actor.profileCode === 'SUPER_ADMIN') return true;
    if (actor.profileCode !== 'STAFF_MANAGER') return false;
    if (!this.isStaffManagerDelegableProfile(account.profileCode))
      return account.id === actor.userId;
    return this.areAllPropertiesInActorScope(actor, account.propertyIds);
  }

  private async assertAdminTargetInScope(actor: ActorContext, id: string): Promise<void> {
    if (actor.profileCode === 'SUPER_ADMIN') return;
    if (actor.profileCode !== 'STAFF_MANAGER' || id === actor.userId) {
      throw new BadRequestException({ code: 'STAFF_MANAGER_PROPERTY_SCOPE_VIOLATION' });
    }
    const [memberships, propertyMemberships] = await Promise.all([
      this.database.query.adminMemberships.findMany({
        where: (fields, { and, eq }) => and(eq(fields.userId, id), eq(fields.status, 'ACTIVE')),
        columns: { role: true },
      }),
      this.database.query.adminPropertyMemberships.findMany({
        where: (fields, { and, eq }) => and(eq(fields.userId, id), eq(fields.status, 'ACTIVE')),
        columns: { propertyId: true },
      }),
    ]);
    const targetProfile =
      memberships
        .map((membership) => membership.role)
        .filter((role): role is AdminProfileCode => isAdminProfile(role))
        .sort((left, right) => ADMIN_PROFILE_RANK[right] - ADMIN_PROFILE_RANK[left])[0] ?? null;
    if (!this.isStaffManagerDelegableProfile(targetProfile)) {
      throw new BadRequestException({ code: 'STAFF_MANAGER_PROFILE_NOT_DELEGABLE' });
    }
    if (
      !this.areAllPropertiesInActorScope(
        actor,
        propertyMemberships
          .map((membership) => membership.propertyId)
          .filter((propertyId): propertyId is string => propertyId !== null),
      )
    ) {
      throw new BadRequestException({ code: 'STAFF_MANAGER_PROPERTY_SCOPE_VIOLATION' });
    }
  }

  private areAllPropertiesInActorScope(
    actor: ActorContext,
    propertyIds: readonly string[],
  ): boolean {
    const actorPropertyIds = actor.propertyIds;
    return (
      actorPropertyIds !== 'ALL' &&
      actorPropertyIds !== undefined &&
      propertyIds.length > 0 &&
      propertyIds.every((propertyId) => actorPropertyIds.includes(propertyId))
    );
  }

  private isStaffManagerDelegableProfile(
    profileCode: AdminProfileCode | null,
  ): profileCode is Exclude<
    AdminProfileCode,
    'SUPER_ADMIN' | 'STAFF_MANAGER' | 'OPERATIONS_MANAGER'
  > {
    return (
      profileCode === 'ROOM_STATUS_VIEWER' ||
      profileCode === 'HOUSEKEEPING_MANAGER' ||
      profileCode === 'HOUSEKEEPING_STAFF' ||
      profileCode === 'PAYMENT_STAFF' ||
      profileCode === 'MAINTENANCE_MANAGER' ||
      profileCode === 'MAINTENANCE_STAFF'
    );
  }

  private requireSuperAdmin(actor: ActorContext): void {
    if (actor.profileCode !== 'SUPER_ADMIN') {
      throw new BadRequestException({ code: 'SUPER_ADMIN_REQUIRED' });
    }
  }

  private async assertSuperAdminRemainsActive(
    target: { readonly role: string; readonly status: string },
    targetProfileCode: AdminProfileCode | null,
    patch: {
      readonly status?: 'ACTIVE' | 'DISABLED' | undefined;
      readonly role?: string | undefined;
      readonly departmentIds?: readonly string[] | undefined;
    },
  ): Promise<void> {
    const targetIsSuperAdmin = target.role === 'SUPER_ADMIN' || targetProfileCode === 'SUPER_ADMIN';
    const removesFinalAccess =
      patch.status === 'DISABLED' ||
      (patch.role !== undefined && patch.role !== 'SUPER_ADMIN') ||
      patch.departmentIds?.length === 0;
    if (!targetIsSuperAdmin || !removesFinalAccess) return;

    const activeSuperAdmins = await this.database.query.users.findMany({
      where: (fields, { and, eq }) =>
        and(eq(fields.role, 'SUPER_ADMIN'), eq(fields.status, 'ACTIVE')),
      columns: { id: true },
    });
    if (activeSuperAdmins.length <= 1) {
      throw new ConflictException({ code: 'LAST_SUPER_ADMIN_FORBIDDEN' });
    }
  }

  private async account(row: typeof users.$inferSelect) {
    const [memberships, propertyMemberships, activeSessions] = await Promise.all([
      this.database.query.adminMemberships.findMany({
        where: (fields, { and, eq }) => and(eq(fields.userId, row.id), eq(fields.status, 'ACTIVE')),
      }),
      this.database.query.adminPropertyMemberships.findMany({
        where: (fields, { and, eq }) => and(eq(fields.userId, row.id), eq(fields.status, 'ACTIVE')),
        columns: { propertyId: true },
      }),
      this.database.query.sessions.findMany({
        where: (fields, { and, eq, gt }) =>
          and(eq(fields.userId, row.id), gt(fields.expiresAt, new Date())),
        columns: { id: true, updatedAt: true },
      }),
    ]);
    const departments = await Promise.all(
      memberships.map(async (membership) => {
        const department = await this.database.query.adminDepartments.findFirst({
          where: (fields, { eq }) => eq(fields.id, membership.departmentId),
          columns: { name: true },
        });
        return department?.name;
      }),
    );
    const profileCode =
      memberships
        .map((membership) => membership.role)
        .filter((role): role is AdminProfileCode => isAdminProfile(role))
        .sort((left, right) => ADMIN_PROFILE_RANK[right] - ADMIN_PROFILE_RANK[left])[0] ?? null;
    return {
      id: row.id,
      displayName: row.name,
      emailMasked: maskEmail(row.email),
      status: row.status,
      role: row.role,
      profileCode,
      profileLabelVi: profileCode === null ? null : ADMIN_PROFILE_LABELS_VI[profileCode],
      departments: departments.filter((name): name is string => name !== undefined),
      propertyIds: propertyMemberships
        .map((membership) => membership.propertyId)
        .filter((propertyId): propertyId is string => propertyId !== null),
      activeSessionCount: activeSessions.length,
      lastActivityAt:
        activeSessions
          .map((session) => session.updatedAt)
          .sort((left, right) => right.getTime() - left.getTime())[0]
          ?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async assertActivePropertyIds(propertyIds: readonly string[]): Promise<void> {
    const activeProperties = await this.database.query.properties.findMany({
      where: (fields, { and, eq }) =>
        and(eq(fields.status, 'ACTIVE'), inArray(fields.id, [...propertyIds])),
      columns: { id: true },
    });
    if (activeProperties.length !== propertyIds.length) {
      throw new BadRequestException({ code: 'PROPERTY_NOT_FOUND' });
    }
  }

  private async writeAudit(
    database: Pick<DatabaseClient, 'insert'>,
    actor: ActorContext,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    await database.insert(auditEvents).values({
      aggregateType: 'ADMIN_ACCESS',
      aggregateId,
      eventType,
      actorType: 'ADMIN',
      actorId: actor.userId,
      payload,
    });
  }
}
