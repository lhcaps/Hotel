import { expect, it } from 'vitest';

it('runs only from the contracts source test directory', () => {
  const executionDirectory = import.meta.dirname.replace(/\\/gu, '/');

  expect(executionDirectory).not.toContain('/dist/test');
  expect(executionDirectory).toMatch(/\/packages\/contracts\/test$/u);
});
