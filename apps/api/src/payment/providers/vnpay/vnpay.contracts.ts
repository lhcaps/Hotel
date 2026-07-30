import { z } from '@room/contracts';

import { VnpayAdapterError } from './vnpay.errors.js';

const nonEmpty = z.string().min(1);

const vnpayIpnSchema = z
  .object({
    vnp_Amount: z.string().regex(/^\d+$/),
    vnp_ResponseCode: z.string().regex(/^\d{2}$/),
    vnp_SecureHash: z.string().regex(/^[a-f0-9]{128}$/),
    vnp_TmnCode: nonEmpty,
    vnp_TransactionNo: z.string().regex(/^\d+$/),
    vnp_TransactionStatus: z.string().regex(/^\d{2}$/),
    vnp_TxnRef: nonEmpty.max(100),
  })
  .catchall(z.string());

/**
 * `QueryDr` response payload. VNPAY returns `vnp_ResponseCode` plus a
 * `vnp_Message` (free text) and, when the transaction exists, the same
 * `vnp_TransactionStatus`, `vnp_TxnRef`, `vnp_Amount`, `vnp_BankCode`,
 * `vnp_PayDate`, and `vnp_TransactionNo` set as the IPN. Duplicate keys
 * are rejected before signature verification.
 */
const vnpayQueryDrResponseSchema = z
  .object({
    vnp_ResponseCode: z.string().regex(/^\d{2}$/),
    vnp_TmnCode: nonEmpty,
    vnp_TxnRef: nonEmpty.max(100),
    vnp_Amount: z.string().regex(/^\d+$/),
    vnp_TransactionNo: z.string().regex(/^\d+$/).optional(),
    vnp_TransactionStatus: z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
    vnp_BankCode: z.string().max(50).optional(),
    vnp_PayDate: z
      .string()
      .regex(/^\d{14}$/)
      .optional(),
    vnp_Message: z.string().max(1_000),
    vnp_SecureHash: z.string().regex(/^[a-f0-9]{128}$/),
  })
  .catchall(z.string());

/**
 * Strictly-typed projection of the QueryDr response used by the adapter.
 * Optional fields have already been resolved against the schema's parsed
 * shape; the projection collapses `unknown` into a precise record so the
 * adapter can read required fields without `| undefined` noise.
 */
export interface VnpayQueryDrResponse {
  readonly vnp_ResponseCode: string;
  readonly vnp_TmnCode: string;
  readonly vnp_TxnRef: string;
  readonly vnp_Amount: string;
  readonly vnp_TransactionNo: string | undefined;
  readonly vnp_TransactionStatus: string | undefined;
  readonly vnp_Message: string;
  readonly vnp_SecureHash: string;
}

/**
 * Converts the provider's raw URL query exactly once. Duplicate keys are
 * rejected before signature verification so an object conversion can never
 * hide a second authoritative value.
 */
export function parseVnpayIpnQuery(rawQuery: string): Record<string, string> {
  const parameters = new URLSearchParams(rawQuery);
  const fields: Record<string, string> = {};
  for (const [key, value] of parameters.entries()) {
    if (Object.hasOwn(fields, key)) throw new VnpayAdapterError('VNPAY_IPN_INVALID_PAYLOAD');
    fields[key] = value;
  }
  const parsed = vnpayIpnSchema.safeParse(fields);
  if (!parsed.success) throw new VnpayAdapterError('VNPAY_IPN_INVALID_PAYLOAD');
  return parsed.data;
}

/**
 * Parses and validates the VNPAY `QueryDr` response. Duplicate keys are
 * rejected before signature verification so a forged response with two
 * `vnp_TransactionNo` values cannot slip past canonicalization.
 */
export function parseVnpayQueryDrResponse(rawBody: string): VnpayQueryDrResponse {
  const parameters = new URLSearchParams(rawBody);
  const fields: Record<string, string> = {};
  for (const [key, value] of parameters.entries()) {
    if (Object.hasOwn(fields, key)) throw new VnpayAdapterError('VNPAY_IPN_INVALID_PAYLOAD');
    fields[key] = value;
  }
  const parsed = vnpayQueryDrResponseSchema.safeParse(fields);
  if (!parsed.success) throw new VnpayAdapterError('VNPAY_IPN_INVALID_PAYLOAD');
  const data = parsed.data;
  return {
    vnp_ResponseCode: data.vnp_ResponseCode,
    vnp_TmnCode: data.vnp_TmnCode,
    vnp_TxnRef: data.vnp_TxnRef,
    vnp_Amount: data.vnp_Amount,
    vnp_TransactionNo: data.vnp_TransactionNo,
    vnp_TransactionStatus: data.vnp_TransactionStatus,
    vnp_Message: data.vnp_Message,
    vnp_SecureHash: data.vnp_SecureHash,
  };
}
