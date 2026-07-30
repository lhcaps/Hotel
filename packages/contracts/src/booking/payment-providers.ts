import { z } from 'zod';

const providerSchema = z.enum(['MOMO', 'VNPAY']);

export const googleProviderReadinessSchema = z.object({
  enabled: z.boolean(),
  unavailableReason: z.literal('CONFIGURATION_REQUIRED').nullable(),
});

export const publicProviderReadinessSchema = z.object({
  google: googleProviderReadinessSchema,
});

export const paymentProviderUnavailableReasonSchema = z.enum([
  'CONFIGURATION_REQUIRED',
  'PROPERTY_DISABLED',
  'MAINTENANCE',
]);

export const paymentProviderAvailabilitySchema = z.object({
  provider: providerSchema,
  displayName: z.string().min(1).max(120),
  displayOrder: z.number().int().nonnegative(),
  checkoutExpiryMinutes: z.number().int().min(1).max(60),
  maintenanceMessage: z.string().max(500).nullable(),
  enabled: z.boolean(),
  unavailableReason: paymentProviderUnavailableReasonSchema.nullable(),
  environment: z.enum(['sandbox', 'production']).optional(),
});

export const paymentProviderAdminSchema = paymentProviderAvailabilitySchema.extend({
  configured: z.boolean(),
  environment: z.enum(['sandbox', 'production']),
});

export const paymentProviderUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    displayOrder: z.number().int().nonnegative().optional(),
    checkoutExpiryMinutes: z.number().int().min(1).max(60).optional(),
    maintenanceMessage: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const vnpayPaymentInitiationResponseSchema = z.object({
  paymentId: z.string().uuid(),
  paymentAttemptId: z.string().uuid(),
  provider: z.literal('VNPAY'),
  status: z.literal('PENDING'),
  redirectUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
