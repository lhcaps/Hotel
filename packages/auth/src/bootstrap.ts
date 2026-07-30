export interface BootstrapAdminInput {
  readonly email: string;
  readonly password: string;
  readonly environment: 'development' | 'test' | 'production';
  readonly productionAcknowledged?: boolean;
}

export interface BootstrapAdminDependencies {
  readonly createAdmin: (input: {
    email: string;
    password: string;
    role: 'ADMIN';
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

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
  dependencies: BootstrapAdminDependencies,
): Promise<{ email: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  validatePassword(input.password);
  if (input.environment === 'production' && input.productionAcknowledged !== true) {
    throw new BootstrapAdminError(
      'Production ADMIN bootstrap requires explicit operator acknowledgement.',
    );
  }

  const created = await dependencies.createAdmin({
    email,
    password: input.password,
    role: 'ADMIN',
    status: 'ACTIVE',
  });
  return { email, created: created.created };
}
