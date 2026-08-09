const SERVICES = ['caddy', 'web', 'payment-demo', 'api', 'worker', 'postgres', 'redis'];
const APP_IMAGES = { web: 'web', api: 'api', worker: 'worker', 'payment-demo': 'paymentDemo' };

export function attestRelease({ manifest, runtimeSnapshot }) {
  const expectedDirectory = `/opt/room-management/releases/${manifest.releaseId}`;
  const services = {};
  const failures = [];
  for (const service of SERVICES) {
    const actual = runtimeSnapshot.services?.[service];
    const checks = [];
    if (!actual) checks.push('missing');
    else {
      if (actual.state !== 'running') checks.push('not-running');
      if (actual.releaseId !== manifest.releaseId) checks.push('release-id');
      if (actual.workingDirectory !== expectedDirectory) checks.push('compose-ownership');
      const imageName = APP_IMAGES[service];
      if (
        imageName &&
        actual.image !==
          `${manifest.images[imageName].repository}@${manifest.images[imageName].digest}`
      )
        checks.push('image');
    }
    services[service] = { match: checks.length === 0, checks };
    if (checks.length > 0) failures.push(`${service}:${checks.join(',')}`);
  }
  if (runtimeSnapshot.currentPointer !== expectedDirectory) failures.push('current-pointer');
  if (runtimeSnapshot.sharedReleaseId !== manifest.releaseId) failures.push('shared-release-id');
  if (runtimeSnapshot.composeSha256 !== manifest.compose.sha256) failures.push('compose-digest');
  if (runtimeSnapshot.caddySha256 !== manifest.caddy.sha256) failures.push('caddy-digest');
  if (runtimeSnapshot.migrationCompleted !== true) failures.push('migration-evidence');
  return { status: failures.length === 0 ? 'PASS' : 'FAIL', failures, services };
}
