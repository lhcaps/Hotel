import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { defaultAc } from 'better-auth/plugins/admin/access';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { admin } from 'better-auth/plugins/admin';
import { randomUUID } from 'node:crypto';

import { loopbackOriginAlias } from '@room/config';
import {
  accounts,
  sessions,
  users,
  verificationRecords,
  type DatabaseClient,
} from '@room/database';

import { buildGoogleSocialProvider, type GoogleAuthEnvironment } from './google-auth.js';

export interface RoomTestGenericOAuthEnvironment {
  readonly providerId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly userInfoUrl: string;
  readonly scopes?: readonly string[];
}

export interface AdminUserCreationInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly role: 'ADMIN' | 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER';
}

const roomAdminRole = defaultAc.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});

interface CreateUserApi {
  createUser(input: { body: AdminUserCreationInput }): Promise<{ user: { id: string } }>;
}

function isCreateUserApi(value: object): value is CreateUserApi {
  return (
    'createUser' in value &&
    typeof (value as { readonly createUser?: unknown }).createUser === 'function'
  );
}

export interface RoomAuthEnvironment {
  readonly BETTER_AUTH_SECRET: string;
  readonly WEB_ORIGIN: string;
  readonly AUTH_BASE_URL: string;
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly googleAuth?: GoogleAuthEnvironment | undefined;
  readonly testGenericOAuth?: RoomTestGenericOAuthEnvironment | undefined;
}

export function createRoomAuth(database: DatabaseClient, environment: RoomAuthEnvironment) {
  const socialProviders: Record<string, unknown> = {};
  if (environment.googleAuth?.enabled === true) {
    for (const provider of buildGoogleSocialProvider(environment.googleAuth)) {
      socialProviders['google'] = provider.google;
    }
  }

  const plugins: Array<ReturnType<typeof admin> | ReturnType<typeof genericOAuth>> = [
    admin({
      defaultRole: 'CUSTOMER',
      adminRoles: ['ADMIN', 'SUPER_ADMIN'],
      roles: {
        ADMIN: roomAdminRole,
        SUPER_ADMIN: roomAdminRole,
        ROOM_STATUS_VIEWER: defaultAc.newRole({ user: [], session: [] }),
        CUSTOMER: defaultAc.newRole({ user: [], session: [] }),
      },
      allowImpersonatingAdmins: false,
    }),
  ];
  if (environment.NODE_ENV === 'test' && environment.testGenericOAuth !== undefined) {
    const testProvider = environment.testGenericOAuth;
    plugins.push(
      genericOAuth({
        config: [
          {
            providerId: testProvider.providerId,
            clientId: testProvider.clientId,
            clientSecret: testProvider.clientSecret,
            authorizationUrl: testProvider.authorizationUrl,
            tokenUrl: testProvider.tokenUrl,
            userInfoUrl: testProvider.userInfoUrl,
            scopes: [...(testProvider.scopes ?? ['openid', 'email', 'profile'])],
            mapProfileToUser: (() => ({ role: 'CUSTOMER' as const })) as never,
          },
        ],
      }),
    );
  }

  return betterAuth({
    secret: environment.BETTER_AUTH_SECRET,
    baseURL: environment.AUTH_BASE_URL,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verificationRecords,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    socialProviders:
      Object.keys(socialProviders).length > 0 ? (socialProviders as never) : undefined,
    plugins: plugins.length > 0 ? plugins : undefined,
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'CUSTOMER', input: false },
        status: { type: 'string', required: false, defaultValue: 'ACTIVE', input: false },
      },
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    trustedOrigins: [
      environment.WEB_ORIGIN,
      ...(() => {
        const alias = loopbackOriginAlias(environment.WEB_ORIGIN);
        return alias === undefined ? [] : [alias];
      })(),
    ],
    advanced: {
      database: {
        // The `verification_records`, `users`, `accounts`, and
        // `customer_profiles` tables declare their primary keys as
        // `uuid` with a `gen_random_uuid()` default. Better Auth's
        // default id generator produces a 32-character random string
        // which cannot be inserted into a `uuid` column. By providing
        // a function-based `generateId` that always emits
        // `crypto.randomUUID()`, we ensure:
        //
        //   - `verification_records.id` accepts the UUID column.
        //   - `users.id`, `accounts.id` (uuid) accept the value when
        //     Better Auth chooses to insert one.
        //   - `sessions.id` (text) still accepts the UUID; the
        //     generated value is a well-formed UUID string and the
        //     column is text.
        //
        // `useUUIDs` is therefore left false so `shouldGenerateId`
        // stays true for every model; the function is invoked on each
        // create and emits a UUID.
        generateId: () => randomUUID(),
      },
      useSecureCookies: environment.NODE_ENV === 'production',
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: environment.NODE_ENV === 'production',
      },
    },
  });
}

export async function createAuthAdminUser(
  auth: ReturnType<typeof createRoomAuth>,
  input: AdminUserCreationInput,
): Promise<{ id: string }> {
  if (!isCreateUserApi(auth.api)) {
    throw new Error('Better Auth admin user creation is unavailable.');
  }
  const result = await auth.api.createUser({ body: input });
  return { id: result.user.id };
}
