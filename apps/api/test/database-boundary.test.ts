import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('API database boundary', () => {
  it('has no direct pg dependency or startup migration command', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const sourceRoot = new URL('../src/', import.meta.url);
    const sourceFiles = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'));
    const productionSources = sourceFiles.join('\n');

    expect(packageJson.dependencies).not.toHaveProperty('pg');
    expect(packageJson.devDependencies).not.toHaveProperty('@types/pg');
    expect(productionSources).not.toMatch(/migrateDatabase|db:migrate|migrations\.js/);
    expect(productionSources).not.toMatch(/from ['"]pg['"]|new (?:Pool|Client)\b/);
  });
});
