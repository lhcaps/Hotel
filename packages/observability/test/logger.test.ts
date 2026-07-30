import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/index.js';

describe('structured logger', () => {
  it('redacts sensitive fields while retaining service and environment', () => {
    const lines: string[] = [];
    const write = (line: string) => {
      lines.push(line);
    };
    const logger = createLogger({ service: 'test', environment: 'test', write });

    logger.info({ password: 'secret-value', requestId: 'request-1' }, 'test event');

    expect(lines).toHaveLength(1);
    const serialized = lines[0] ?? '';
    expect(serialized).toContain('"service":"test"');
    expect(serialized).toContain('"environment":"test"');
    expect(serialized).not.toContain('secret-value');
  });
});
