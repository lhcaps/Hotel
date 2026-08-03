import { fromNodeHeaders } from 'better-auth/node';

export interface AuthRequestHandler {
  handler(request: Request): Promise<Response>;
}

interface BridgeRequest {
  readonly method: string;
  readonly url: string;
  readonly protocol: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
}

export interface AuthHeaderReply {
  header(name: string, value: string | readonly string[]): unknown;
}

interface BridgeReply extends AuthHeaderReply {
  status(statusCode: number): BridgeReply;
  send(payload: string | { code: string; message: string }): unknown;
}

export interface AuthFastifyRouter {
  route(options: {
    method: readonly ['GET', 'POST'];
    url: '/api/auth/*';
    handler: (request: BridgeRequest, reply: BridgeReply) => Promise<unknown>;
  }): unknown;
}

export function forwardAuthResponseHeaders(response: Response, reply: AuthHeaderReply): void {
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
  });
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length > 0) reply.header('set-cookie', setCookies);
}

export function createAuthFastifyHandler(auth: AuthRequestHandler) {
  return async (request: BridgeRequest, reply: BridgeReply): Promise<unknown> => {
    try {
      const host = request.headers.host;
      const url = new URL(request.url, `${request.protocol}://${host ?? 'localhost'}`);
      const body =
        request.body === undefined || request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : JSON.stringify(request.body);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(body === undefined ? {} : { body }),
        }),
      );
      forwardAuthResponseHeaders(response, reply);
      return reply.status(response.status).send(await response.text());
    } catch {
      return reply.status(500).send({
        code: 'AUTH_FAILURE',
        message: 'Authentication service unavailable.',
      });
    }
  };
}

export function registerAuthFastifyRoute(
  router: AuthFastifyRouter,
  auth: AuthRequestHandler,
): void {
  router.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: createAuthFastifyHandler(auth),
  });
}
