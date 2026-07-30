import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { loopbackOriginAlias, requireApiEnvironment } from '@room/config';
import { createLogger } from '@room/observability';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './errors/problem-details.filter.js';
import { trustedProxy } from './trusted-proxy.js';

let logger = createLogger({ service: 'api', environment: 'unknown' });

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});

async function bootstrap(): Promise<void> {
  const environment = requireApiEnvironment();
  logger = createLogger({
    service: 'api',
    environment: environment.NODE_ENV,
    level: environment.LOG_LEVEL,
  });

  const adapter = new FastifyAdapter({
    logger: false,
    trustProxy: trustedProxy(environment.TRUSTED_PROXY_CIDRS),
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: false,
    rawBody: true,
  });

  const loopbackAlias = loopbackOriginAlias(environment.WEB_ORIGIN);
  await app.register(cookie as never, {});
  await app.register(cors, {
    credentials: true,
    methods: ['GET', 'HEAD', 'PATCH', 'POST', 'OPTIONS'],
    origin: [environment.WEB_ORIGIN, ...(loopbackAlias ? [loopbackAlias] : [])],
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    const correlationId = request.headers['x-correlation-id'];
    if (typeof correlationId === 'string') {
      reply.header('x-correlation-id', correlationId);
    }
  });

  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
  logger.info({ port: environment.API_PORT }, 'API started');
}

void bootstrap().catch((error: unknown) => {
  logger.error({ err: error }, 'API startup failed');
  process.exitCode = 1;
});
