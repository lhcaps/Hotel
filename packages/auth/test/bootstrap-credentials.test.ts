import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('bootstrap credential fixtures', () => {
  it('does not keep a reusable ADMIN password in committed test source', () => {
    const testSource = readFileSync(new URL('./bootstrap.test.ts', import.meta.url), 'utf8');
    const reusablePassword = ['Correct', 'Horse', 'Battery', '42'].join('-');

    expect(testSource).not.toContain(reusablePassword);
  });
});
