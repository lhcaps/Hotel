import { Buffer } from 'node:buffer';
import { Controller, HttpCode, Inject, Post, Req, Version } from '@nestjs/common';
import { applyVerifiedPaymentEvent } from '@room/booking';
import type { DatabasePool } from '@room/database';
import { createLogger } from '@room/observability';

import { DatabaseProvider } from '../database/database.provider.js';
import { MOMO_ADAPTER } from './payment.tokens.js';
import { MomoAdapter } from './providers/momo/momo.adapter.js';

const logger = createLogger({ service: 'api', environment: process.env.NODE_ENV ?? 'unknown' });

interface WebhookRequest {
  readonly id: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly rawBody?: Buffer;
}

@Controller('webhooks/momo')
export class MomoWebhookController {
  public constructor(
    @Inject(DatabaseProvider) private readonly database: DatabaseProvider,
    @Inject(MOMO_ADAPTER) private readonly adapter: MomoAdapter | null,
  ) {}

  @Post()
  @Version('1')
  @HttpCode(204)
  public async receive(@Req() request: WebhookRequest): Promise<void> {
    if (this.adapter === null || request.rawBody === undefined) {
      logger.warn({ requestId: request.id, code: 'MOMO_IPN_REJECTED' }, 'momo.ipn.rejected');
      return;
    }
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    try {
      const event = await this.adapter.verifyAndNormalizeWebhook({
        rawBody: request.rawBody,
        headers,
        receivedAt: new Date(),
      });
      if (
        event.providerTransactionId === null ||
        event.amountVnd === null ||
        event.currency !== 'VND'
      ) {
        throw new Error('MOMO normalized event is incomplete');
      }
      const result = await applyVerifiedPaymentEvent({
        pool: this.database.pool as unknown as DatabasePool,
        provider: 'MOMO',
        eventKey: event.eventKey,
        providerOrderId: event.providerOrderId,
        providerTransactionId: event.providerTransactionId,
        normalizedOutcome: event.normalizedOutcome,
        amountVnd: event.amountVnd,
        currency: event.currency,
        occurredAt: event.occurredAt,
        rawBodyDigest: event.rawBodyDigest,
        verificationMarker: event.verificationMarker,
      });
      logger.info(
        {
          requestId: request.id,
          providerOrderId: event.providerOrderId,
          result: result.processingStatus,
        },
        'momo.ipn.settled',
      );
    } catch {
      logger.warn({ requestId: request.id, code: 'MOMO_IPN_REJECTED' }, 'momo.ipn.rejected');
    }
  }
}
