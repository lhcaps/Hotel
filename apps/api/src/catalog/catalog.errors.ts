export class CatalogNotFoundError extends Error {
  public readonly code: string;

  public constructor(code = 'CATALOG_NOT_FOUND', message?: string) {
    super(message ?? 'The requested catalog resource was not found.');
    this.name = 'CatalogNotFoundError';
    this.code = code;
  }
}

export class CatalogConflictError extends Error {
  public readonly code: string;

  public constructor(code = 'CATALOG_CONFLICT', message?: string) {
    super(message ?? 'The requested catalog change conflicts with existing data.');
    this.name = 'CatalogConflictError';
    this.code = code;
  }
}
