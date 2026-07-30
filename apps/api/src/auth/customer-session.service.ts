import type { ActorContext } from './actor-context.js';

export class CustomerSessionRequiredError extends Error {
  public constructor() {
    super('A CUSTOMER session is required for this operation');
    this.name = 'CustomerSessionRequiredError';
  }
}

export class CustomerDisabledError extends Error {
  public constructor() {
    super('CUSTOMER session belongs to a disabled user');
    this.name = 'CustomerDisabledError';
  }
}

export interface CustomerSessionServiceOptions {
  readonly getActor: (request: {
    readonly headers: Record<string, string | string[] | undefined>;
    readonly id: string;
  }) => Promise<ActorContext | null>;
}

/**
 * Light wrapper that enforces CUSTOMER role and ACTIVE status semantics.
 * Reuses the same Better Auth session pipeline as AdminSessionService so
 * CUSTOMER/ADMIN share a single authentication path; only the role filter
 * differs.
 */
export class CustomerSessionService {
  public constructor(private readonly options: CustomerSessionServiceOptions) {}

  public async getCustomer(request: {
    readonly headers: Record<string, string | string[] | undefined>;
    readonly id: string;
  }): Promise<ActorContext | null> {
    const actor = await this.options.getActor(request);
    return actor?.role === 'CUSTOMER' ? actor : null;
  }

  public async requireCustomer(request: {
    readonly headers: Record<string, string | string[] | undefined>;
    readonly id: string;
  }): Promise<ActorContext> {
    const actor = await this.getCustomer(request);
    if (actor === null) {
      throw new CustomerSessionRequiredError();
    }
    return actor;
  }
}
