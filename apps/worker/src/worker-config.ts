import { z } from 'zod';

const workerModeSchema = z.enum(['continuous', 'once']);

const positiveBoundedInteger = (minimum: number, maximum: number) =>
  z.coerce
    .number()
    .int()
    .min(minimum, { message: `must be a positive integer >= ${minimum}` })
    .max(maximum, { message: `must be a bounded integer <= ${maximum}` });

const workerConfigSchema = z
  .object({
    WORKER_MODE: workerModeSchema.default('continuous'),
    WORKER_OUTBOX_INTERVAL_MS: positiveBoundedInteger(50, 3_600_000).default(2_000),
    WORKER_EXPIRATION_INTERVAL_MS: positiveBoundedInteger(50, 3_600_000).default(30_000),
    WORKER_ERROR_BACKOFF_MS: positiveBoundedInteger(50, 3_600_000).default(1_000),
    WORKER_MAX_ERROR_BACKOFF_MS: positiveBoundedInteger(50, 3_600_000).default(60_000),
    WORKER_RECONCILIATION_BATCH_SIZE: positiveBoundedInteger(1, 100).default(25),
    WORKER_RECONCILIATION_LEASE_TTL_MS: positiveBoundedInteger(1_000, 15 * 60_000).default(
      120_000,
    ),
    WORKER_RECONCILIATION_INTERVAL_MS: positiveBoundedInteger(1_000, 3_600_000).default(30_000),
    WORKER_RECONCILIATION_CONCURRENCY: positiveBoundedInteger(1, 25).default(5),
    WORKER_RECONCILIATION_MAX_ATTEMPTS: positiveBoundedInteger(1, 32).default(8),
  })
  .superRefine((value, context) => {
    if (value.WORKER_MAX_ERROR_BACKOFF_MS < value.WORKER_ERROR_BACKOFF_MS) {
      context.addIssue({
        code: 'custom',
        path: ['WORKER_MAX_ERROR_BACKOFF_MS'],
        message: 'WORKER_MAX_ERROR_BACKOFF_MS must be >= WORKER_ERROR_BACKOFF_MS',
      });
    }
  });

export type WorkerMode = z.infer<typeof workerModeSchema>;
export type WorkerOperationalConfig = z.infer<typeof workerConfigSchema>;

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: Error };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function parseWorkerOperationalConfig(
  source: Record<string, string | undefined>,
): ParseResult<WorkerOperationalConfig> {
  const result = workerConfigSchema.safeParse(source);
  if (result.success) return { success: true, data: result.data };
  const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ');
  return { success: false, error: new Error(`Invalid worker operational config: ${names}`) };
}

export function requireWorkerOperationalConfig(
  source: Record<string, string | undefined> = process.env,
): WorkerOperationalConfig {
  const result = parseWorkerOperationalConfig(source);
  if (!result.success) throw result.error;
  return result.data;
}
