import { Module } from '@nestjs/common';
import type { DatabasePool } from '@room/database';

import { AuthModule } from '../auth/auth.module.js';
import { BookingModule } from '../booking/booking.module.js';
import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AdminOperationalReportController } from './admin-operational-report.controller.js';
import { AdminOperationalReportRepository } from './admin-operational-report.repository.js';
import { AdminOperationalReportService } from './admin-operational-report.service.js';

@Module({
  imports: [AppDatabaseModule, AuthModule, BookingModule],
  controllers: [AdminOperationalReportController],
  providers: [
    {
      provide: AdminOperationalReportRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): AdminOperationalReportRepository =>
        new AdminOperationalReportRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: AdminOperationalReportService,
      inject: [AdminOperationalReportRepository],
      useFactory: (repository: AdminOperationalReportRepository): AdminOperationalReportService =>
        new AdminOperationalReportService(repository),
    },
  ],
})
export class ReportingModule {}
