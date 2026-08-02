import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'room-gitleaks-fixtures-'));
const approvedFixturePaths = [
  'apps/api/test/integration/gate-b9-race-matrix.integration.test.ts',
  'apps/api/test/payment/admin-payment-reconciliation.service.test.ts',
  'apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts',
  'docs/runbooks/momo-sandbox.md',
  'packages/auth/test/auth-factory-security.test.ts',
  'packages/booking/test/concurrency/gate-b9-cross-provider-race.test.ts',
  'packages/booking/test/payment/payment-settlement.test.ts',
  'packages/booking/test/payment/reconciliation.test.ts',
  'tests/e2e/verify-admin-contract.spec.ts',
  'tests/e2e/verify-admin-pages.spec.ts',
  'tests/e2e/verify-enable-providers.spec.ts',
  'tests/e2e/verify-screenshots.spec.ts',
];

function scan(source, expectsFindings) {
  try {
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${source}:/scan:ro`,
        '-v',
        `${join(repositoryRoot, '.gitleaks.toml')}:/config/.gitleaks.toml:ro`,
        'ghcr.io/gitleaks/gitleaks:v8.25.0',
        'detect',
        '--source',
        '/scan',
        '--no-git',
        '--no-banner',
        '--config',
        '/config/.gitleaks.toml',
      ],
      { stdio: 'ignore' },
    );
    if (expectsFindings) {
      throw new Error('Gitleaks unexpectedly accepted a credential-shaped fixture.');
    }
  } catch (error) {
    if (!expectsFindings) {
      throw new Error('Gitleaks rejected an approved deterministic fixture.', { cause: error });
    }
  }
}

function writeFixture(root, relativePath, contents) {
  const destination = join(root, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents, 'utf8');
}

try {
  const approvedRoot = join(temporaryRoot, 'approved');
  for (const relativePath of approvedFixturePaths) {
    const destination = join(approvedRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(repositoryRoot, relativePath), destination);
  }
  scan(approvedRoot, false);

  const awsRoot = join(temporaryRoot, 'aws');
  writeFixture(
    awsRoot,
    'credential-shaped-fixture.env',
    `AWS_ACCESS_KEY_ID=${['AKIA', 'IOSFODNN7EXAMPLE'].join('')}\n`,
  );
  scan(awsRoot, true);

  const privateKeyRoot = join(temporaryRoot, 'private-key');
  writeFixture(
    privateKeyRoot,
    'credential-shaped-fixture.pem',
    ['-----BEGIN ', 'PRIVATE KEY-----', 'synthetic', '-----END PRIVATE KEY-----'].join('\n'),
  );
  scan(privateKeyRoot, true);

  const genericRoot = join(temporaryRoot, 'generic');
  writeFixture(
    genericRoot,
    'credential-shaped-fixture.env',
    `GENERIC_API_KEY=${['synthetic', 'CredentialShapeOnly', '000000000000000000000000'].join('')}\n`,
  );
  scan(genericRoot, true);

  const placeholderRoot = join(temporaryRoot, 'placeholder');
  writeFixture(
    placeholderRoot,
    'deploy/.env.production.example',
    'MOMO_SECRET_KEY=REPLACE_WITH_32_PLUS_CHAR_MOMO_SECRET\n',
  );
  scan(placeholderRoot, false);

  const credentialRoot = join(temporaryRoot, 'credential');
  writeFixture(
    credentialRoot,
    'deploy/.env.production.example',
    `MOMO_SECRET_KEY=${['synthetic', 'CredentialShapeOnly', '000000000000000000000000'].join('')}\n`,
  );
  scan(credentialRoot, true);

  console.log('Gitleaks fixture regression passed.');
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
