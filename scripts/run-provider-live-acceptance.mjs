import { spawnSync } from 'node:child_process';

const provider = process.argv[2];
const definitions = {
  google: {
    ready: 'GOOGLE_LIVE_READY=READY',
    blocked: 'GOOGLE_LIVE_LOCAL=BLOCKED_MISSING_USER_CREDENTIALS',
    command:
      'Open the local application, initiate Google sign-in, complete authentication manually, then verify the callback and application session without recording tokens.',
  },
  momo: {
    ready: 'MOMO_SANDBOX_READY=READY',
    blocked: 'MOMO_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS',
    command:
      'Create only the dedicated sandbox test booking, complete the provider step manually, and retain application audit evidence after a signed IPN.',
  },
  vnpay: {
    ready: 'VNPAY_SANDBOX_READY=READY',
    blocked: 'VNPAY_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS',
    command:
      'Create only the dedicated sandbox test booking, complete the provider step manually, and retain application audit evidence after a signed IPN.',
  },
  smtp: {
    ready: 'SMTP_LIVE_READY=READY',
    blocked: 'SMTP_LIVE=BLOCKED_MISSING_SMTP_CREDENTIALS',
    command:
      'Send only synthetic test data to SMTP_LIVE_TEST_RECIPIENT and record external receipt manually without storing message content.',
  },
};

const definition = definitions[provider];
if (definition === undefined) {
  process.stderr.write(
    'Usage: node scripts/run-provider-live-acceptance.mjs <google|momo|vnpay|smtp>\n',
  );
  process.exitCode = 1;
} else {
  const check = spawnSync(process.execPath, ['scripts/check-providers.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
  const output = `${check.stdout ?? ''}${check.stderr ?? ''}`;
  process.stdout.write(output);
  if (!output.includes(definition.ready)) {
    process.stdout.write(`${definition.blocked}\n`);
    process.stdout.write('LIVE_ACCEPTANCE_MANUAL_CHECKPOINT=NOT_STARTED\n');
    process.exitCode = 0;
  } else {
    process.stdout.write('LIVE_ACCEPTANCE_MANUAL_CHECKPOINT=REQUIRED\n');
    process.stdout.write(`LIVE_ACCEPTANCE_INSTRUCTIONS=${definition.command}\n`);
    process.stdout.write('LIVE_ACCEPTANCE=NOT_RUN_MANUAL_CHECKPOINT_REQUIRED\n');
    process.exitCode = 0;
  }
}
