import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, properties, type DatabaseClient } from '@room/database';
import { publicContactSchema, type PublicContact } from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';

@Injectable()
export class PublicContactService {
  public constructor(@Inject('DATABASE_CLIENT') private readonly database: DatabaseClient) {}

  public async getByCode(code: string): Promise<PublicContact> {
    const row = await this.database.query.properties.findFirst({
      where: (fields, { eq: e }) => e(fields.code, code),
      columns: { publicContact: true, status: true },
    });
    if (row === undefined || row.status !== 'ACTIVE') {
      // Returning null/undefined causes Nest's underlying adapter to reply 404.
      // Surface an explicit empty object so the public landing page can render
      // without spurious 404 console noise.
      return {};
    }
    return parsePersistedContact(row.publicContact) ?? {};
  }

  public async setById(actor: ActorContext, id: string, input: unknown): Promise<PublicContact> {
    if (actor.profileCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException({ code: 'SUPER_ADMIN_REQUIRED' });
    }
    const parsed = publicContactSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        detail: 'Public contact payload is invalid.',
      });
    }
    const sanitized: PublicContact = {
      phone: emptyToUndefined(parsed.data.phone),
      zalo: emptyToUndefined(parsed.data.zalo),
      address: emptyToUndefined(parsed.data.address),
      facebook: emptyToUndefined(parsed.data.facebook),
    };
    const [updated] = await this.database
      .update(properties)
      .set({ publicContact: sanitized as never, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning({ publicContact: properties.publicContact });
    if (updated === undefined) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND' });
    }
    return parsePersistedContact(updated.publicContact) ?? sanitized;
  }
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function parsePersistedContact(value: unknown): PublicContact | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const candidateShape = {
    phone: typeof candidate['phone'] === 'string' ? candidate['phone'] : undefined,
    zalo: typeof candidate['zalo'] === 'string' ? candidate['zalo'] : undefined,
    address: typeof candidate['address'] === 'string' ? candidate['address'] : undefined,
    facebook: typeof candidate['facebook'] === 'string' ? candidate['facebook'] : undefined,
  };
  const parsed = publicContactSchema.safeParse(candidateShape);
  if (!parsed.success) {
    // Existing persisted jsonb failed the new schema. Drop it silently rather
    // than crash the public landing page; the admin can re-save valid values.
    return null;
  }
  return parsed.data;
}
