import { z } from 'zod';

const uuidSchema = z.string().uuid();
const readableTextSchema = z.string().trim().min(1).max(2_000);
const secretValueSchema = z.string().trim().min(1).max(512);

export const arrivalAccessSecretMutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('REPLACE'), value: secretValueSchema }).strict(),
  z.object({ action: z.literal('CLEAR') }).strict(),
]);

export const propertyArrivalAccessConfigSchema = z
  .object({
    propertyId: uuidSchema,
    gatePassConfigured: z.boolean(),
    wifiPasswordConfigured: z.boolean(),
    wifiSsid: readableTextSchema.nullable(),
    supportContact: readableTextSchema.nullable(),
    defaultArrivalInstruction: readableTextSchema.nullable(),
    preparationNote: readableTextSchema.nullable(),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const propertyArrivalAccessConfigPatchSchema = z
  .object({
    gatePass: arrivalAccessSecretMutationSchema.optional(),
    wifiPassword: arrivalAccessSecretMutationSchema.optional(),
    wifiSsid: readableTextSchema.nullable().optional(),
    supportContact: readableTextSchema.nullable().optional(),
    defaultArrivalInstruction: readableTextSchema.nullable().optional(),
    preparationNote: readableTextSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'Patch is empty.' });
    }
  });

export const roomArrivalAccessConfigSchema = z
  .object({
    roomId: uuidSchema,
    propertyId: uuidSchema,
    roomPassConfigured: z.boolean(),
    roomLocation: readableTextSchema.nullable(),
    arrivalInstruction: readableTextSchema.nullable(),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const roomArrivalAccessConfigPatchSchema = z
  .object({
    roomPass: arrivalAccessSecretMutationSchema.optional(),
    roomLocation: readableTextSchema.nullable().optional(),
    arrivalInstruction: readableTextSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'Patch is empty.' });
    }
  });

export type ArrivalAccessSecretMutation = z.infer<typeof arrivalAccessSecretMutationSchema>;
export type PropertyArrivalAccessConfig = z.infer<typeof propertyArrivalAccessConfigSchema>;
export type PropertyArrivalAccessConfigPatch = z.infer<
  typeof propertyArrivalAccessConfigPatchSchema
>;
export type RoomArrivalAccessConfig = z.infer<typeof roomArrivalAccessConfigSchema>;
export type RoomArrivalAccessConfigPatch = z.infer<typeof roomArrivalAccessConfigPatchSchema>;
