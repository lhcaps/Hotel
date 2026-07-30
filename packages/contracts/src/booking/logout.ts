import { z } from 'zod';

export const guestLogoutResponseSchema = z
  .object({
    loggedOutAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type GuestLogoutResponse = z.infer<typeof guestLogoutResponseSchema>;
