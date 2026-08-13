import {
  propertyArrivalAccessConfigs,
  roomArrivalAccessConfigs,
  type DatabaseClient,
} from '@room/database';
import {
  propertyArrivalAccessConfigPatchSchema,
  propertyArrivalAccessConfigSchema,
  roomArrivalAccessConfigPatchSchema,
  roomArrivalAccessConfigSchema,
  type ArrivalAccessSecretMutation,
  type PropertyArrivalAccessConfig,
  type RoomArrivalAccessConfig,
} from '@room/contracts';
import { ArrivalAccessCrypto } from '@room/booking';

import type { ActorContext } from '../../auth/actor-context.js';
import { AuditRepository } from '../../catalog/audit.repository.js';
import { CatalogNotFoundError } from '../../catalog/catalog.errors.js';
import { PropertyContextService } from '../../catalog/property-context.service.js';

export class ArrivalAccessConfigurationIncompleteError extends Error {
  public readonly code = 'ARRIVAL_ACCESS_CONFIGURATION_INCOMPLETE';

  public constructor() {
    super('Arrival access information is not configured for this stay.');
    this.name = 'ArrivalAccessConfigurationIncompleteError';
  }
}

interface CustomerArrivalPackage {
  readonly gatePass: string;
  readonly roomPass: string;
  readonly wifi: { readonly ssid: string; readonly password: string };
  readonly location: string;
  readonly instructions: string;
  readonly preparationNote: string;
  readonly supportContact: string;
}

export class ArrivalAccessConfigService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly propertyContext: PropertyContextService,
    private readonly crypto: ArrivalAccessCrypto,
    private readonly audit = new AuditRepository(),
  ) {}

  public async getPropertyForAdmin(actor: ActorContext): Promise<PropertyArrivalAccessConfig> {
    const property = await this.propertyContext.getCurrent(actor);
    const config = await this.database.query.propertyArrivalAccessConfigs.findFirst({
      where: (row, operators) => operators.eq(row.propertyId, property.id),
    });
    return this.toPropertyResponse(property.id, config);
  }

  public async updatePropertyForAdmin(actor: ActorContext, input: unknown) {
    const command = propertyArrivalAccessConfigPatchSchema.parse(input);
    const property = await this.propertyContext.getCurrent(actor);
    return this.database.transaction(async (transaction) => {
      const existing = await transaction.query.propertyArrivalAccessConfigs.findFirst({
        where: (row, operators) => operators.eq(row.propertyId, property.id),
      });
      const now = new Date();
      const gatePassEncrypted = this.nextSecret(command.gatePass, existing?.gatePassEncrypted, {
        scope: 'property',
        id: property.id,
        field: 'gatePass',
      });
      const wifiPasswordEncrypted = this.nextSecret(
        command.wifiPassword,
        existing?.wifiPasswordEncrypted,
        {
          scope: 'property',
          id: property.id,
          field: 'wifiPassword',
        },
      );
      const [saved] = await transaction
        .insert(propertyArrivalAccessConfigs)
        .values({
          propertyId: property.id,
          gatePassEncrypted,
          wifiPasswordEncrypted,
          wifiSsid:
            command.wifiSsid === undefined ? (existing?.wifiSsid ?? null) : command.wifiSsid,
          supportContact:
            command.supportContact === undefined
              ? (existing?.supportContact ?? null)
              : command.supportContact,
          defaultArrivalInstruction:
            command.defaultArrivalInstruction === undefined
              ? (existing?.defaultArrivalInstruction ?? null)
              : command.defaultArrivalInstruction,
          preparationNote:
            command.preparationNote === undefined
              ? (existing?.preparationNote ?? null)
              : command.preparationNote,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: propertyArrivalAccessConfigs.propertyId,
          set: {
            gatePassEncrypted,
            wifiPasswordEncrypted,
            wifiSsid:
              command.wifiSsid === undefined ? (existing?.wifiSsid ?? null) : command.wifiSsid,
            supportContact:
              command.supportContact === undefined
                ? (existing?.supportContact ?? null)
                : command.supportContact,
            defaultArrivalInstruction:
              command.defaultArrivalInstruction === undefined
                ? (existing?.defaultArrivalInstruction ?? null)
                : command.defaultArrivalInstruction,
            preparationNote:
              command.preparationNote === undefined
                ? (existing?.preparationNote ?? null)
                : command.preparationNote,
            updatedAt: now,
          },
        })
        .returning();
      if (saved === undefined)
        throw new Error('Arrival access configuration update did not return a row.');
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'PROPERTY_ARRIVAL_ACCESS_CONFIG',
        aggregateId: property.id,
        eventType: 'PROPERTY_ARRIVAL_ACCESS_CONFIG_UPDATED',
        actorId: actor.userId,
        payload: { fieldCategories: this.fieldCategories(command).join(',') },
      });
      return this.toPropertyResponse(property.id, saved);
    });
  }

  public async getRoomForAdmin(
    actor: ActorContext,
    roomId: string,
  ): Promise<RoomArrivalAccessConfig> {
    const property = await this.propertyContext.getCurrent(actor);
    await this.requireRoom(property.id, roomId);
    const config = await this.database.query.roomArrivalAccessConfigs.findFirst({
      where: (row, operators) =>
        operators.and(operators.eq(row.propertyId, property.id), operators.eq(row.roomId, roomId)),
    });
    return this.toRoomResponse(property.id, roomId, config);
  }

  public async updateRoomForAdmin(actor: ActorContext, roomId: string, input: unknown) {
    const command = roomArrivalAccessConfigPatchSchema.parse(input);
    const property = await this.propertyContext.getCurrent(actor);
    await this.requireRoom(property.id, roomId);
    return this.database.transaction(async (transaction) => {
      const existing = await transaction.query.roomArrivalAccessConfigs.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.propertyId, property.id),
            operators.eq(row.roomId, roomId),
          ),
      });
      const now = new Date();
      const roomPassEncrypted = this.nextSecret(command.roomPass, existing?.roomPassEncrypted, {
        scope: 'room',
        id: roomId,
        field: 'roomPass',
      });
      const roomLocation =
        command.roomLocation === undefined
          ? (existing?.roomLocation ?? null)
          : command.roomLocation;
      const arrivalInstruction =
        command.arrivalInstruction === undefined
          ? (existing?.arrivalInstruction ?? null)
          : command.arrivalInstruction;
      const [saved] = await transaction
        .insert(roomArrivalAccessConfigs)
        .values({
          roomId,
          propertyId: property.id,
          roomPassEncrypted,
          roomLocation,
          arrivalInstruction,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: roomArrivalAccessConfigs.roomId,
          set: { roomPassEncrypted, roomLocation, arrivalInstruction, updatedAt: now },
        })
        .returning();
      if (saved === undefined)
        throw new Error('Room arrival access configuration update did not return a row.');
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM_ARRIVAL_ACCESS_CONFIG',
        aggregateId: roomId,
        eventType: 'ROOM_ARRIVAL_ACCESS_CONFIG_UPDATED',
        actorId: actor.userId,
        payload: { fieldCategories: this.fieldCategories(command).join(',') },
      });
      return this.toRoomResponse(property.id, roomId, saved);
    });
  }

  public async resolveCustomerPackage(input: {
    readonly propertyId: string;
    readonly roomId: string;
  }): Promise<CustomerArrivalPackage> {
    const [property, room] = await Promise.all([
      this.database.query.propertyArrivalAccessConfigs.findFirst({
        where: (row, operators) => operators.eq(row.propertyId, input.propertyId),
      }),
      this.database.query.roomArrivalAccessConfigs.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.propertyId, input.propertyId),
            operators.eq(row.roomId, input.roomId),
          ),
      }),
    ]);
    if (
      property?.gatePassEncrypted === null ||
      property?.gatePassEncrypted === undefined ||
      property.wifiSsid === null ||
      property.wifiSsid === undefined ||
      property.wifiPasswordEncrypted === null ||
      property.wifiPasswordEncrypted === undefined ||
      property.supportContact === null ||
      property.supportContact === undefined ||
      property.defaultArrivalInstruction === null ||
      property.defaultArrivalInstruction === undefined ||
      property.preparationNote === null ||
      property.preparationNote === undefined ||
      room?.roomPassEncrypted === null ||
      room?.roomPassEncrypted === undefined ||
      room.roomLocation === null ||
      room.roomLocation === undefined
    ) {
      throw new ArrivalAccessConfigurationIncompleteError();
    }
    try {
      return {
        gatePass: this.crypto.decrypt(property.gatePassEncrypted, {
          scope: 'property',
          id: input.propertyId,
          field: 'gatePass',
        }),
        roomPass: this.crypto.decrypt(room.roomPassEncrypted, {
          scope: 'room',
          id: input.roomId,
          field: 'roomPass',
        }),
        wifi: {
          ssid: property.wifiSsid,
          password: this.crypto.decrypt(property.wifiPasswordEncrypted, {
            scope: 'property',
            id: input.propertyId,
            field: 'wifiPassword',
          }),
        },
        location: room.roomLocation,
        instructions: room.arrivalInstruction ?? property.defaultArrivalInstruction,
        preparationNote: property.preparationNote,
        supportContact: property.supportContact,
      };
    } catch {
      throw new ArrivalAccessConfigurationIncompleteError();
    }
  }

  private async requireRoom(propertyId: string, roomId: string): Promise<void> {
    const room = await this.database.query.rooms.findFirst({
      where: (row, operators) =>
        operators.and(operators.eq(row.propertyId, propertyId), operators.eq(row.id, roomId)),
      columns: { id: true },
    });
    if (room === undefined) throw new CatalogNotFoundError();
  }

  private nextSecret(
    mutation: ArrivalAccessSecretMutation | undefined,
    existing: string | null | undefined,
    context: Parameters<ArrivalAccessCrypto['encrypt']>[1],
  ): string | null {
    if (mutation === undefined) return existing ?? null;
    if (mutation.action === 'CLEAR') return null;
    return this.crypto.encrypt(mutation.value, context);
  }

  private toPropertyResponse(
    propertyId: string,
    value: typeof propertyArrivalAccessConfigs.$inferSelect | undefined,
  ): PropertyArrivalAccessConfig {
    return propertyArrivalAccessConfigSchema.parse({
      propertyId,
      gatePassConfigured:
        value?.gatePassEncrypted !== null && value?.gatePassEncrypted !== undefined,
      wifiPasswordConfigured:
        value?.wifiPasswordEncrypted !== null && value?.wifiPasswordEncrypted !== undefined,
      wifiSsid: value?.wifiSsid ?? null,
      supportContact: value?.supportContact ?? null,
      defaultArrivalInstruction: value?.defaultArrivalInstruction ?? null,
      preparationNote: value?.preparationNote ?? null,
      updatedAt: value?.updatedAt.toISOString() ?? null,
    });
  }

  private toRoomResponse(
    propertyId: string,
    roomId: string,
    value: typeof roomArrivalAccessConfigs.$inferSelect | undefined,
  ): RoomArrivalAccessConfig {
    return roomArrivalAccessConfigSchema.parse({
      roomId,
      propertyId,
      roomPassConfigured:
        value?.roomPassEncrypted !== null && value?.roomPassEncrypted !== undefined,
      roomLocation: value?.roomLocation ?? null,
      arrivalInstruction: value?.arrivalInstruction ?? null,
      updatedAt: value?.updatedAt.toISOString() ?? null,
    });
  }

  private fieldCategories(value: Record<string, unknown>): readonly string[] {
    return Object.keys(value)
      .sort()
      .map((field) =>
        field === 'gatePass' || field === 'wifiPassword' || field === 'roomPass'
          ? 'SECRET'
          : 'CONTENT',
      );
  }
}
