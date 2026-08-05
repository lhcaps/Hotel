export interface BootstrapAdminInput {
  readonly email: string;
  readonly password: string;
  readonly role?: BootstrapAdminRole;
  readonly environment: 'development' | 'test' | 'production';
  readonly productionAcknowledged?: boolean;
}

export type BootstrapAdminRole = 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER';

export interface BootstrapAdminDependencies {
  readonly createAdmin: (input: {
    email: string;
    password: string;
    role: BootstrapAdminRole;
    status: 'ACTIVE';
  }) => Promise<{ id: string; created: boolean }>;
}

export class BootstrapAdminError extends Error {}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BootstrapAdminError('A valid ADMIN bootstrap email is required.');
  }
  return normalized;
}

function validatePassword(password: string): void {
  const strong =
    password.length >= 16 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password);
  if (!strong) {
    throw new BootstrapAdminError(
      'ADMIN bootstrap password does not meet the minimum strength policy.',
    );
  }
}

function normalizeRole(role: BootstrapAdminRole | undefined): BootstrapAdminRole {
  if (role === undefined) return 'SUPER_ADMIN';
  if (role === 'SUPER_ADMIN' || role === 'ROOM_STATUS_VIEWER') return role;
  throw new BootstrapAdminError('ADMIN bootstrap role must be SUPER_ADMIN or ROOM_STATUS_VIEWER.');
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
  dependencies: BootstrapAdminDependencies,
): Promise<{ email: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  validatePassword(input.password);
  const role = normalizeRole(input.role);
  if (input.environment === 'production' && input.productionAcknowledged !== true) {
    throw new BootstrapAdminError(
      'Production ADMIN bootstrap requires explicit operator acknowledgement.',
    );
  }

  const created = await dependencies.createAdmin({
    email,
    password: input.password,
    role,
    status: 'ACTIVE',
  });
  return { email, created: created.created };
}
