import { z } from 'zod';

/** The checkout handoff contains no provider credential or signed payload. */
export const momoPaymentInitiationResponseSchema = z.object({
  paymentId: z.string().uuid(),
  paymentAttemptId: z.string().uuid(),
  provider: z.literal('MOMO'),
  status: z.literal('PENDING'),
  redirectUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});

export type MomoPaymentInitiationResponse = z.infer<typeof momoPaymentInitiationResponseSchema>;
