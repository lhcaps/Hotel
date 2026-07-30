import { Pool } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  const pool = new Pool({ connectionString, application_name: 'check-migration-identity' });
  try {
    const meta = await pool.query<{ id: number; schema_version: string }>(
      'SELECT id, schema_version FROM schema_metadata',
    );
    process.stdout.write(`schema_metadata: ${JSON.stringify(meta.rows)}\n`);
    const migrations = await pool.query<{ id: number; hash: string; created_at: Date | string }>(
      'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id',
    );
    process.stdout.write(
      `drizzle migrations: ${JSON.stringify(
        migrations.rows.map((row) => ({
          id: row.id,
          hash: row.hash,
          created_at:
            row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        })),
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
