import pino, { type Logger } from 'pino';

const sensitivePaths = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'otp',
  'signature',
  'accessToken',
  'refreshToken',
  'session',
  '*.password',
  '*.token',
  '*.authorization',
  '*.cookie',
  '*.secret',
  '*.otp',
  '*.signature',
  '*.accessToken',
  '*.refreshToken',
  '*.session',
];

export interface LoggerOptions {
  service: string;
  environment: string;
  level?: string;
  write?: (line: string) => void;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino(
    {
      base: { service: options.service, environment: options.environment },
      level: options.level ?? 'info',
      redact: { paths: sensitivePaths, censor: '[REDACTED]' },
    },
    options.write === undefined ? undefined : { write: options.write },
  );
}
