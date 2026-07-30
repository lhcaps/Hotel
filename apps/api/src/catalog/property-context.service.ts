import { type DatabaseClient } from '@room/database';

export interface CurrentProperty {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
}

export class PropertyContextError extends Error {
  public readonly code = 'PROPERTY_NOT_FOUND';
  public constructor() {
    super('No active property is configured.');
    this.name = 'PropertyContextError';
  }
}

export class PropertyContextService {
  public constructor(private readonly client: DatabaseClient) {}

  public async getCurrent(): Promise<CurrentProperty> {
    const row = await this.client.query.properties.findFirst({
      where: (fields, { eq }) => eq(fields.status, 'ACTIVE'),
      orderBy: (fields, { asc }) => asc(fields.createdAt),
    });
    if (row === undefined) {
      throw new PropertyContextError();
    }
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
    };
  }
}
