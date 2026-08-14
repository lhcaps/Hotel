import { z } from 'zod';

const phonePattern = /^\+[1-9][0-9]{6,14}$/;
const urlPattern = /^https?:\/\/[^\s]+$/i;

export const publicContactSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(32, { message: 'Phone must not exceed 32 characters.' })
    .refine((value) => phonePattern.test(value), {
      message: 'Phone must be in E.164 format (e.g. +84901234567).',
    })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  zalo: z
    .string()
    .trim()
    .max(2048, { message: 'Zalo link must not exceed 2048 characters.' })
    .refine((value) => urlPattern.test(value), {
      message: 'Zalo link must be a valid URL (https://…).',
    })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  address: trimmedNullableString(500).optional(),
  facebook: z
    .string()
    .trim()
    .max(2048, { message: 'Facebook link must not exceed 2048 characters.' })
    .refine((value) => urlPattern.test(value), {
      message: 'Facebook link must be a valid URL (https://…).',
    })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

function trimmedNullableString(max: number) {
  return z
    .string()
    .trim()
    .max(max, { message: `Must be ${max} characters or fewer.` })
    .optional()
    .or(z.literal('').transform(() => undefined));
}

export type PublicContact = z.infer<typeof publicContactSchema>;
export type PublicContactInput = z.input<typeof publicContactSchema>;
