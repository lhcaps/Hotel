import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://room:room@localhost:5432/room_management_schema_generation_only',
  },
  strict: true,
  verbose: true,
});
