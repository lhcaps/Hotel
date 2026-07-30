export interface PlaywrightRuntime {
  readonly PLAYWRIGHT_BETTER_AUTH_SECRET: string;
  readonly PLAYWRIGHT_ADMIN_PASSWORD: string;
}

export function validateBetterAuthSecret(value: unknown): boolean;
export function validateAdminPassword(value: unknown): boolean;
export function resolvePlaywrightRuntime(source?: NodeJS.ProcessEnv): PlaywrightRuntime;
export function ensurePlaywrightRuntime(environment?: NodeJS.ProcessEnv): PlaywrightRuntime;
