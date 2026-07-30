import { Buffer } from 'node:buffer';
import { Controller, Get, HttpCode, Inject, Req, Version } from '@nestjs/common';
import { applyVerifiedPaymentEvent } from '@room/booking';
import type { DatabasePool } from '@room/database';

import { DatabaseProvider } from '../database/database.provider.js';
import { VNPAY_ADAPTER } from './payment.tokens.js';
import { VnpayAdapter } from './providers/vnpay/vnpay.adapter.js';
import { VnpayAdapterError } from './providers/vnpay/vnpay.errors.js';

interface VnpayIpnRequest {
  readonly raw: { readonly url?: string };
}

@Controller('webhooks/vnpay')
export class VnpayWebhookController {
  public constructor(
    @Inject(DatabaseProvider) private readonly database: DatabaseProvider,
    @Inject(VNPAY_ADAPTER) private readonly adapter: VnpayAdapter | null,
  ) {}

  @Get()
  @Version('1')
  @HttpCode(200)
  public async receive(@Req() request: VnpayIpnRequest) {
    if (this.adapter === null) return { RspCode: '99', Message: 'Provider unavailable' };
    try {
      const requestTarget = request.raw.url ?? '';
      const separator = requestTarget.indexOf('?');
      if (separator < 0 || separator === requestTarget.length - 1) {
        throw new VnpayAdapterError('VNPAY_IPN_INVALID_PAYLOAD');
      }
      const event = await this.adapter.verifyAndNormalizeWebhook({
        rawBody: Buffer.from(requestTarget.slice(separator + 1), 'utf8'),
        headers: {},
        receivedAt: new Date(),
      });
      if (event.providerTransactionId === null || event.amountVnd === null)
        throw new Error('incomplete VNPAY event');
      await applyVerifiedPaymentEvent({
        pool: this.database.pool as DatabasePool,
        provider: 'VNPAY',
        eventKey: event.eventKey,
        providerOrderId: event.providerOrderId,
        providerTransactionId: event.providerTransactionId,
        normalizedOutcome: event.normalizedOutcome,
        amountVnd: event.amountVnd,
        currency: 'VND',
        occurredAt: event.occurredAt,
        rawBodyDigest: event.rawBodyDigest,
        verificationMarker: event.verificationMarker,
      });
      return { RspCode: '00', Message: 'success' };
    } catch (error) {
      if (
        error instanceof VnpayAdapterError &&
        (error.code === 'VNPAY_IPN_SIGNATURE_INVALID' || error.code === 'VNPAY_IPN_INVALID_PAYLOAD')
      ) {
        return { RspCode: '97', Message: 'Fail checksum' };
      }
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }
}
