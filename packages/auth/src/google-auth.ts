export interface GoogleAuthEnvironment {
  readonly enabled: boolean;
  readonly clientId?: string | undefined;
  readonly clientSecret?: string | undefined;
  readonly redirectUri?: string | undefined;
}

export interface GoogleProviderModule {
  readonly google: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly redirectURI: string;
    readonly mapProfileToUser: () => { readonly role: 'CUSTOMER' };
  };
}

export function buildGoogleSocialProvider(
  environment: GoogleAuthEnvironment,
): readonly GoogleProviderModule[] {
  if (!environment.enabled) {
    return [];
  }
  const clientId = environment.clientId;
  const clientSecret = environment.clientSecret;
  const redirectUri = environment.redirectUri;
  if (clientId === undefined || clientSecret === undefined || redirectUri === undefined) {
    throw new Error(
      'Google social provider requires clientId, clientSecret, and redirectUri when enabled',
    );
  }
  return [
    {
      google: {
        clientId,
        clientSecret,
        redirectURI: redirectUri,
        mapProfileToUser: () => ({ role: 'CUSTOMER' }),
      },
    },
  ];
}
