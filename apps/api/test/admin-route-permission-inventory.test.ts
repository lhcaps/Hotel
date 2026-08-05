import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function controllerFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return controllerFiles(path);
    return entry.endsWith('.controller.ts') ? [path] : [];
  });
}

describe('admin route permission inventory', () => {
  it('keeps every admin controller route behind an explicit permission decorator', () => {
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
    const adminControllers = controllerFiles(sourceRoot).filter((path) => {
      const source = readFileSync(path, 'utf8');
      return /@Controller\(['"]admin(?:\/|['"])/.test(source);
    });
    expect(adminControllers.length).toBeGreaterThan(0);

    const routeDecorator = /@(Get|Post|Patch|Put|Delete)\([^)]*\)/g;
    for (const path of adminControllers) {
      const source = readFileSync(path, 'utf8');
      const routes = [...source.matchAll(routeDecorator)];
      expect(routes.length, path).toBeGreaterThan(0);
      routes.forEach((route, index) => {
        const start = route.index ?? 0;
        const end = routes[index + 1]?.index ?? source.length;
        expect(source.slice(start, end), `${path}:${route[0]}`).toMatch(/@RequirePermissions\(/);
      });
    }
  });
});
