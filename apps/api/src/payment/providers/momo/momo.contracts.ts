import { z } from '@room/contracts';

export const momoCreateResponseSchema = z
  .object({
    partnerCode: z.string().min(1).max(50),
    orderId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(50),
    amount: z.number().int().min(1_000).max(50_000_000),
    responseTime: z.number().int().positive(),
    message: z.string().min(1).max(1_000),
    resultCode: z.number().int(),
    payUrl: z.string().url().optional(),
    signature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .passthrough();

export const momoIpnSchema = z
  .object({
    orderType: z.literal('momo_wallet'),
    amount: z.number().int().min(1_000).max(50_000_000),
    partnerCode: z.string().min(1).max(50),
    orderId: z.string().min(1).max(200),
    extraData: z.string().max(1_000),
    signature: z.string().regex(/^[a-f0-9]{64}$/),
    // A provider may serialize an identifier beyond JavaScript's safe-integer
    // range. Keep it as text in that case so canonicalization is lossless.
    transId: z.union([
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      z.string().regex(/^\d+$/),
    ]),
    responseTime: z.number().int().positive(),
    resultCode: z.number().int(),
    message: z.string().min(1).max(1_000),
    payType: z.enum(['webApp', 'app', 'qr', 'miniapp', 'aio_qr', 'banktransfer_qr']),
    requestId: z.string().min(1).max(50),
    orderInfo: z.string().min(1).max(255),
  })
  .passthrough();

/**
 * `POST /v2/gateway/api/query` response shape. The query endpoint reuses the
 * signed-field contract documented for the create-response payload, with
 * `payUrl` omitted because no redirect is generated. `transId` is optional in
 * the query response because not-found orders do not carry one.
 */
export const momoQueryResponseSchema = z
  .object({
    partnerCode: z.string().min(1).max(50),
    orderId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(50),
    amount: z.number().int().min(0),
    responseTime: z.number().int().nonnegative(),
    message: z.string().min(1).max(1_000),
    resultCode: z.number().int(),
    transId: z
      .union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^\d+$/)])
      .optional(),
    signature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .passthrough();

export type MomoCreateResponse = z.infer<typeof momoCreateResponseSchema>;
export type MomoIpn = z.infer<typeof momoIpnSchema>;
export type MomoQueryResponse = z.infer<typeof momoQueryResponseSchema>;
