import { describe, expect, it, vi } from 'vitest';

import { WorkerLifecycle } from '../src/lifecycle.js';

describe('WorkerLifecycle', () => {
  it('closes Redis once during graceful shutdown', async () => {
    const close = vi.fn(async () => undefined);
    const lifecycle = new WorkerLifecycle({ close });

    await lifecycle.shutdown('SIGINT');
    await lifecycle.shutdown('SIGTERM');

    expect(close).toHaveBeenCalledTimes(1);
  });
});
