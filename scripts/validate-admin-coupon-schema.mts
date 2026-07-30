import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const adminArtifactPath = resolve(import.meta.dirname, '../docs/openapi/admin-v1.json');

type Schema = Record<string, unknown>;

interface CaseSpec {
  readonly label: string;
  readonly payload: Schema;
  readonly expect: 'accept' | 'reject';
}

function buildBranch(
  discountType: 'FIXED' | 'PERCENTAGE',
  overrides: Record<string, unknown> = {},
): Schema {
  const base: Record<string, unknown> = {
    code: 'FIXED-CASE',
    discountType,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T00:00:00Z',
    roomTypes: { all: true },
  };
  return { ...base, ...overrides } as Schema;
}

async function loadAdminSchema(): Promise<Schema> {
  const document = JSON.parse(await readFile(adminArtifactPath, 'utf8')) as {
    readonly components?: { readonly schemas?: Record<string, Schema> };
  };
  const schema = document.components?.schemas?.AdminCouponCreate;
  if (!schema) {
    throw new Error('admin-v1.json must define AdminCouponCreate schema.');
  }
  return schema;
}

function assertSchemaIsOneOf(schema: Schema): void {
  const oneOf = schema.oneOf as ReadonlyArray<unknown> | undefined;
  if (!Array.isArray(oneOf)) {
    throw new Error('AdminCouponCreate must be an explicit JSON Schema oneOf.');
  }
  if (oneOf.length !== 2) {
    throw new Error('AdminCouponCreate.oneOf must have exactly 2 branches.');
  }
  for (const branch of oneOf) {
    if (
      typeof branch !== 'object' ||
      branch === null ||
      (branch as Schema).additionalProperties !== false
    ) {
      throw new Error('AdminCouponCreate oneOf branches must set additionalProperties=false.');
    }
  }
}

interface ValidationResult {
  readonly ok: boolean;
  readonly errors: ReadonlyArray<{ instancePath: string; message: string }>;
}

function runValidation(schema: Schema, payload: Schema): ValidationResult {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats.default(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(payload) as boolean;
  const rawErrors: ReadonlyArray<ErrorObject> = validate.errors ?? [];
  const errors = rawErrors.map((err) => ({
    instancePath: err.instancePath ?? '',
    message: err.message ?? '',
  }));
  return { ok, errors };
}

function buildCases(): ReadonlyArray<CaseSpec> {
  const fixed = buildBranch('FIXED', { fixedAmountVnd: 10000 });
  const percentage = buildBranch('PERCENTAGE', { percentageBasisPoints: 1500 });
  return [
    { label: 'valid FIXED accepted', payload: fixed, expect: 'accept' },
    { label: 'valid PERCENTAGE accepted', payload: percentage, expect: 'accept' },
    {
      label: 'FIXED plus percentageBasisPoints rejected',
      payload: { ...fixed, percentageBasisPoints: 1500 },
      expect: 'reject',
    },
    {
      label: 'PERCENTAGE plus fixedAmountVnd rejected',
      payload: { ...percentage, fixedAmountVnd: 10000 },
      expect: 'reject',
    },
    {
      label: 'missing fixedAmountVnd rejected',
      payload: {
        code: fixed.code,
        discountType: fixed.discountType,
        validFrom: fixed.validFrom,
        validUntil: fixed.validUntil,
        roomTypes: fixed.roomTypes,
      },
      expect: 'reject',
    },
    {
      label: 'missing percentageBasisPoints rejected',
      payload: {
        code: percentage.code,
        discountType: percentage.discountType,
        validFrom: percentage.validFrom,
        validUntil: percentage.validUntil,
        roomTypes: percentage.roomTypes,
      },
      expect: 'reject',
    },
    {
      label: 'firstReferencedAt rejected',
      payload: { ...fixed, firstReferencedAt: '2026-06-01T00:00:00Z' },
      expect: 'reject',
    },
    {
      label: 'disabledAt rejected',
      payload: { ...fixed, disabledAt: '2026-06-01T00:00:00Z' },
      expect: 'reject',
    },
    {
      label: 'usage counts rejected',
      payload: { ...fixed, usageCount: 0, redeemedCount: 0 },
      expect: 'reject',
    },
    {
      label: 'customer digest rejected',
      payload: { ...fixed, customerEmailDigest: '00' },
      expect: 'reject',
    },
    {
      label: 'unknown fields rejected',
      payload: { ...fixed, unknownField: 'x' },
      expect: 'reject',
    },
  ];
}

async function main(): Promise<void> {
  const schema = await loadAdminSchema();
  assertSchemaIsOneOf(schema);
  const cases = buildCases();
  let failures = 0;
  for (const testCase of cases) {
    const result = runValidation(schema, testCase.payload);
    const okExpected = testCase.expect === 'accept';
    if (result.ok !== okExpected) {
      failures += 1;
      process.stderr.write(
        `[FAIL] ${testCase.label}: expected ${testCase.expect}, got ${result.ok ? 'accept' : `reject (${JSON.stringify(result.errors)})`}\n`,
      );
    } else {
      process.stdout.write(`[PASS] ${testCase.label}\n`);
    }
  }
  if (failures > 0) {
    process.stderr.write(
      `AdminCouponCreate validation failed: ${failures}/${cases.length} cases\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(`AdminCouponCreate validation: all ${cases.length} cases passed.\n`);
  }
}

await main();
