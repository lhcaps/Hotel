import {
  and,
  asc,
  auditEvents,
  eq,
  paymentProviderSettings,
  properties,
  type DatabaseClient,
} from '@room/database';
import type { ApiEnvironment } from '@room/config';
import { z } from '@room/contracts';

import { PaymentProviderSettingsError } from '../payment-provider-settings.errors.js';

export interface PublicPaymentProvider {
  readonly provider: 'MOMO' | 'VNPAY';
  readonly displayName: string;
  readonly displayOrder: number;
  readonly checkoutExpiryMinutes: number;
  readonly maintenanceMessage: string | null;
  readonly enabled: boolean;
  readonly unavailableReason: 'CONFIGURATION_REQUIRED' | 'PROPERTY_DISABLED' | 'MAINTENANCE' | null;
  readonly environment?: 'sandbox' | 'production';
}

export class PaymentProviderSettingsService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly environment: ApiEnvironment,
  ) {}

  public async listPublic(): Promise<readonly PublicPaymentProvider[]> {
    const property = await this.getCurrentProperty();
    const rows = await this.database.query.paymentProviderSettings.findMany({
      where: (row, operators) => operators.eq(row.propertyId, property.id),
      orderBy: [asc(paymentProviderSettings.displayOrder), asc(paymentProviderSettings.provider)],
    });
    return rows.map((row) => this.toPublicProvider(row));
  }

  public async listAdmin() {
    const property = await this.getCurrentProperty();
    const rows = await this.database.query.paymentProviderSettings.findMany({
      where: (row, operators) => operators.eq(row.propertyId, property.id),
      orderBy: [asc(paymentProviderSettings.displayOrder), asc(paymentProviderSettings.provider)],
    });
    return rows.map((row) => this.toAdminProvider(row, this.isConfigured(row.provider)));
  }

  public async isAvailable(provider: 'MOMO' | 'VNPAY', propertyId: string): Promise<boolean> {
    if (!this.isConfigured(provider)) return false;
    const row = await this.database.query.paymentProviderSettings.findFirst({
      where: (setting, operators) =>
        operators.and(
          operators.eq(setting.propertyId, propertyId),
          operators.eq(setting.provider, provider),
          operators.eq(setting.enabled, true),
          operators.isNull(setting.maintenanceMessage),
        ),
    });
    return row !== undefined;
  }

  public async update(provider: 'MOMO' | 'VNPAY', input: unknown, actorId: string) {
    const command = z
      .object({
        enabled: z.boolean().optional(),
        displayName: z.string().trim().min(1).max(120).optional(),
        displayOrder: z.number().int().min(0).optional(),
        checkoutExpiryMinutes: z.number().int().min(1).max(60).optional(),
        maintenanceMessage: z.string().trim().max(500).nullable().optional(),
      })
      .strict()
      .parse(input);
    const configured = this.isConfigured(provider);
    if (command.enabled === true && !configured) {
      throw new PaymentProviderSettingsError('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }
    return this.database.transaction(async (transaction) => {
      const property = await transaction.query.properties.findFirst({
        orderBy: (row, operators) => [operators.asc(row.createdAt), operators.asc(row.id)],
      });
      if (property === undefined) {
        throw new PaymentProviderSettingsError('PAYMENT_PROVIDER_PROPERTY_NOT_FOUND');
      }
      const [updated] = await transaction
        .update(paymentProviderSettings)
        .set({ ...command, updatedAt: new Date() })
        .where(
          and(
            eq(paymentProviderSettings.propertyId, property.id),
            eq(paymentProviderSettings.provider, provider),
          ),
        )
        .returning();
      if (updated === undefined)
        throw new PaymentProviderSettingsError('PAYMENT_PROVIDER_NOT_FOUND');
      await transaction.insert(auditEvents).values({
        propertyId: property.id,
        aggregateType: 'PAYMENT_PROVIDER_SETTING',
        aggregateId: updated.id,
        eventType: 'PAYMENT_PROVIDER_SETTING_UPDATED',
        actorType: 'ADMIN',
        actorId,
        payload: {
          provider: updated.provider,
          enabled: updated.enabled,
          displayName: updated.displayName,
          displayOrder: updated.displayOrder,
          checkoutExpiryMinutes: updated.checkoutExpiryMinutes,
        },
      });
      return this.toAdminProvider(updated, configured);
    });
  }

  private async getCurrentProperty() {
    const property = await this.database.query.properties.findFirst({
      orderBy: [asc(properties.createdAt), asc(properties.id)],
    });
    if (property === undefined) {
      throw new PaymentProviderSettingsError('PAYMENT_PROVIDER_PROPERTY_NOT_FOUND');
    }
    return property;
  }

  private isConfigured(provider: 'MOMO' | 'VNPAY'): boolean {
    return provider === 'MOMO' ? this.environment.MOMO_ENABLED : this.environment.VNPAY_ENABLED;
  }

  private toPublicProvider(
    row: typeof paymentProviderSettings.$inferSelect,
  ): PublicPaymentProvider {
    const configured = this.isConfigured(row.provider);
    const unavailableReason = !configured
      ? 'CONFIGURATION_REQUIRED'
      : !row.enabled
        ? 'PROPERTY_DISABLED'
        : row.maintenanceMessage !== null
          ? 'MAINTENANCE'
          : null;
    return {
      provider: row.provider,
      displayName: row.displayName,
      displayOrder: row.displayOrder,
      checkoutExpiryMinutes: row.checkoutExpiryMinutes,
      maintenanceMessage: row.maintenanceMessage,
      enabled: unavailableReason === null,
      unavailableReason,
      ...(configured
        ? {
            environment:
              row.provider === 'MOMO'
                ? this.environment.MOMO_ENVIRONMENT
                : this.environment.VNPAY_ENVIRONMENT,
          }
        : {}),
    };
  }

  private toAdminProvider(row: typeof paymentProviderSettings.$inferSelect, configured: boolean) {
    return {
      ...this.toPublicProvider(row),
      configured,
      enabled: row.enabled,
      environment:
        row.provider === 'MOMO'
          ? this.environment.MOMO_ENVIRONMENT
          : this.environment.VNPAY_ENVIRONMENT,
    };
  }
}
