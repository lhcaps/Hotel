import { Module } from '@nestjs/common';
import { type ApiEnvironment } from '@room/config';

import {
  createApplicationDatabaseProvider,
  DatabaseProvider,
} from './database.provider.js';

export const API_ENVIRONMENT = Symbol('API_ENVIRONMENT');

@Module({
  providers: [
    {
      provide: API_ENVIRONMENT,
      useFactory: (): Pick<ApiEnvironment, 'DATABASE_URL'> => {
        const env = process.env;
        return {
          DATABASE_URL: env.DATABASE_URL ?? '',
        };
      },
    },
    {
      provide: DatabaseProvider,
      inject: [API_ENVIRONMENT],
      useFactory: createApplicationDatabaseProvider,
    },
  ],
  exports: [DatabaseProvider],
})
export class AppDatabaseModule {}
