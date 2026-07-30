import { Buffer } from 'node:buffer';
import { guestLogoutResponseSchema, type GuestLogoutResponse } from '@room/contracts';

import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';
import { GuestSessionService } from './guest-session.service.js';

export class GuestLogoutService {
  public constructor(
    private readonly repository: GuestAccessRepository,
    private readonly session: GuestSessionService,
  ) {}

  public async logout(sessionToken: Buffer | null, now: Date): Promise<GuestLogoutResponse> {
    if (sessionToken !== null) {
      const digest = this.session.digestForRevoke(sessionToken);
      await this.repository.revokeSession({ tokenDigest: digest, now });
    }
    return guestLogoutResponseSchema.parse({ loggedOutAt: now.toISOString() });
  }
}
