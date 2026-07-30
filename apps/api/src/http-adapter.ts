import { randomUUID } from 'node:crypto';

import { FastifyAdapter } from '@nestjs/platform-fastify';

export function createApiHttpAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: 1_048_576,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
}
