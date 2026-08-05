import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ADMIN V2 membership migration', () => {
  it('is a forward, idempotent, scoped data bootstrap with a matching snapshot', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const migrationPath = resolve(root, 'drizzle/0028_admin_v2_membership_bootstrap.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(existsSync(resolve(root, 'drizzle/meta/0028_snapshot.json'))).toBe(true);
    expect(sql).toContain("u.role::text IN ('SUPER_ADMIN', 'ROOM_STATUS_VIEWER')");
    expect(sql).toContain('ON CONFLICT ("user_id") DO NOTHING');
    expect(sql).toContain('ON CONFLICT ("user_id", "department_id") DO NOTHING');
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i);
    expect(sql).not.toContain("u.role::text IN ('ADMIN'");
  });
});
