import { z } from 'zod';

const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Must be ${max} characters or fewer.` });

const nullableTrimmed = (max: number) =>
  trimmedString(max).transform((value) => (value.length === 0 ? null : value));

export const customerProfileUpdateSchema = z
  .object({
    name: trimmedString(120).min(1, { message: 'Display name is required.' }),
    phone: z
      .string()
      .trim()
      .max(32, { message: 'Phone must not exceed 32 characters.' })
      .refine((value) => PHONE_PATTERN.test(value), {
        message: 'Phone must be in E.164 format (e.g. +84901234567).',
      })
      .optional()
      .or(z.literal('').transform(() => undefined)),
    addressLine1: nullableTrimmed(200).optional(),
    addressLine2: nullableTrimmed(200).optional(),
    ward: nullableTrimmed(200).optional(),
    district: nullableTrimmed(200).optional(),
    province: nullableTrimmed(200).optional(),
    postalCode: nullableTrimmed(32).optional(),
    countryCode: z
      .string()
      .trim()
      .regex(COUNTRY_PATTERN, { message: 'Country code must be a 2-letter ISO code.' }),
  })
  .transform((value) => ({
    name: value.name,
    phone: value.phone ?? null,
    addressLine1: value.addressLine1 ?? null,
    addressLine2: value.addressLine2 ?? null,
    ward: value.ward ?? null,
    district: value.district ?? null,
    province: value.province ?? null,
    postalCode: value.postalCode ?? null,
    countryCode: value.countryCode.toUpperCase(),
  }));

export type CustomerProfileUpdate = z.infer<typeof customerProfileUpdateSchema>;
