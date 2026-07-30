import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Phase 3 test commands', () => {
  it('keeps auth, catalog, and combined integration targets distinct', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['test:auth']).toBe(
      'pnpm --filter @room/auth test:unit && pnpm --filter @room/api exec vitest run --exclude dist/** --exclude test/integration/** test/actor-context.test.ts test/admin-permission.guard.test.ts test/admin-session.service.test.ts test/auth-fastify-bridge.test.ts',
    );
    expect(packageJson.scripts['test:catalog']).toBe('pnpm --filter @room/api test:integration');
    expect(packageJson.scripts['test:integration']).toBe('pnpm test:auth && pnpm test:catalog');
  });

  it('reserves distinct Phase 4 suite commands', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['test:pricing']).toBe(
      'pnpm --filter @room/api exec vitest run test/pricing-engine.test.ts',
    );
    expect(packageJson.scripts['test:availability']).toBe(
      'pnpm --filter @room/api exec node ../../scripts/with-local-env.mjs vitest run test/integration/availability.integration.test.ts',
    );
    expect(packageJson.scripts['test:quotes']).toBe(
      'pnpm --filter @room/api exec node ../../scripts/with-local-env.mjs vitest run test/integration/quote.integration.test.ts',
    );
  });
});
