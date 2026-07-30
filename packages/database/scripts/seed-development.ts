import { seedDevelopmentData } from '../src/seed-development.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required');
}

await seedDevelopmentData(databaseUrl, { environment: process.env.NODE_ENV });
process.stdout.write('Development seed applied\n');
