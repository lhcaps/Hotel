import { Module } from '@nestjs/common';
import { createRoomAuth } from '@room/auth';
import { requireApiEnvironment, type ApiEnvironment } from '@room/config';

import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { API_ENVIRONMENT } from './auth.providers.js';
import { AdminSessionService } from './admin-session.service.js';
import { AdminPermissionGuard } from './admin-permission.guard.js';
import { createAdminSessionService, ROOM_AUTH } from './auth.providers.js';
import {
  CustomerSessionService,
  type CustomerSessionServiceOptions,
} from './customer-session.service.js';
import { AuthController } from './auth.controller.js';
import { ProviderReadinessController } from './provider-readiness.controller.js';

/**
 * Provides the Better Auth–backed services used by every authenticated
 * controller. `ROOM_AUTH` and `API_ENVIRONMENT` are built here so all
 * child modules see the same instances through the export list.
 */
@Module({
  imports: [AppDatabaseModule],
  controllers: [AuthController, ProviderReadinessController],
  providers: [
    {
      provide: API_ENVIRONMENT,
      useFactory: (): ApiEnvironment => {
        const environment = requireApiEnvironment();
        return environment;
      },
    },
    {
      provide: ROOM_AUTH,
      inject: [API_ENVIRONMENT, DatabaseProvider],
      useFactory: (
        environment: ApiEnvironment,
        database: DatabaseProvider,
      ): ReturnType<typeof createRoomAuth> => {
        const hasTestOAuth =
          environment.ROOM_TEST_OAUTH_AUTHORIZATION_URL !== undefined &&
          environment.ROOM_TEST_OAUTH_TOKEN_URL !== undefined &&
          environment.ROOM_TEST_OAUTH_USERINFO_URL !== undefined &&
          environment.ROOM_TEST_OAUTH_PROVIDER_ID !== undefined &&
          environment.ROOM_TEST_OAUTH_CLIENT_ID !== undefined &&
          environment.ROOM_TEST_OAUTH_CLIENT_SECRET !== undefined;
        return createRoomAuth(database.client, {
          BETTER_AUTH_SECRET: environment.BETTER_AUTH_SECRET,
          WEB_ORIGIN: environment.WEB_ORIGIN,
          AUTH_BASE_URL: environment.AUTH_BASE_URL,
          NODE_ENV: environment.NODE_ENV,
          googleAuth: {
            enabled: environment.GOOGLE_AUTH_ENABLED,
            clientId: environment.GOOGLE_CLIENT_ID,
            clientSecret: environment.GOOGLE_CLIENT_SECRET,
            redirectUri: environment.GOOGLE_REDIRECT_URI ?? environment.GOOGLE_AUTH_BASE_URL,
          },
          ...(hasTestOAuth
            ? {
                testGenericOAuth: {
                  providerId: environment.ROOM_TEST_OAUTH_PROVIDER_ID as string,
                  clientId: environment.ROOM_TEST_OAUTH_CLIENT_ID as string,
                  clientSecret: environment.ROOM_TEST_OAUTH_CLIENT_SECRET as string,
                  authorizationUrl: environment.ROOM_TEST_OAUTH_AUTHORIZATION_URL as string,
                  tokenUrl: environment.ROOM_TEST_OAUTH_TOKEN_URL as string,
                  userInfoUrl: environment.ROOM_TEST_OAUTH_USERINFO_URL as string,
                  ...(environment.ROOM_TEST_OAUTH_SCOPES !== undefined
                    ? {
                        scopes: environment.ROOM_TEST_OAUTH_SCOPES.split(',')
                          .map((value) => value.trim())
                          .filter((value) => value.length > 0),
                      }
                    : {}),
                },
              }
            : {}),
        });
      },
    },
    {
      provide: AdminSessionService,
      inject: [ROOM_AUTH, DatabaseProvider],
      useFactory: (
        auth: ReturnType<typeof createRoomAuth>,
        database: DatabaseProvider,
      ): AdminSessionService => createAdminSessionService(auth, database),
    },
    {
      provide: CustomerSessionService,
      inject: [AdminSessionService],
      useFactory: (sessions: AdminSessionService): CustomerSessionService =>
        new CustomerSessionService({
          getActor: (request) => sessions.getActor(request),
        } satisfies CustomerSessionServiceOptions),
    },
    AdminPermissionGuard,
  ],
  exports: [
    API_ENVIRONMENT,
    ROOM_AUTH,
    AdminSessionService,
    CustomerSessionService,
    AdminPermissionGuard,
  ],
})
export class AuthModule {}
