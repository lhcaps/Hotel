import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const publicRoomAmenitySchema = z
  .object({ name: z.string().trim().min(1).max(160) })
  .strict();

export const publicRoomTypeSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(2_000).nullable(),
    maxAdults: z.number().int().min(1),
    maxChildren: z.number().int().min(0),
    maxOccupancy: z.number().int().min(1),
    amenities: z.array(publicRoomAmenitySchema),
  })
  .strict();

export const publicRoomCatalogResponseSchema = z
  .object({ items: z.array(publicRoomTypeSchema) })
  .strict();

export type PublicRoomCatalogResponse = z.infer<typeof publicRoomCatalogResponseSchema>;
export type PublicRoomType = z.infer<typeof publicRoomTypeSchema>;
