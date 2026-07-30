export class DatabaseSafetyError extends Error {
  override readonly name = 'DatabaseSafetyError';
}

export class DatabaseMigrationError extends Error {
  override readonly name = 'DatabaseMigrationError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class DatabaseSchemaError extends Error {
  override readonly name = 'DatabaseSchemaError';
}
