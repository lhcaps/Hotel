import { expect, it } from 'vitest';

it('runs only from the database source unit-test directory', () => {
  const executionDirectory = import.meta.dirname.replace(/\\/gu, '/');

  expect(executionDirectory).not.toContain('/dist/');
  expect(executionDirectory).toMatch(/\/packages\/database\/test\/unit$/u);
});
