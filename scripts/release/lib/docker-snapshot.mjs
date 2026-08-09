import { execFileSync } from 'node:child_process';

const APP_IMAGES = { web: 'web', api: 'api', worker: 'worker', 'payment-demo': 'paymentDemo' };

function inspectProject(project) {
  const identifiers = execFileSync(
    'docker',
    ['ps', '--quiet', '--filter', `label=com.docker.compose.project=${project}`],
    { encoding: 'utf8' },
  )
    .split(/\r?\n/u)
    .filter(Boolean);
  return identifiers.length === 0
    ? []
    : JSON.parse(execFileSync('docker', ['inspect', ...identifiers], { encoding: 'utf8' }));
}

function releaseId(container) {
  return (
    container.Config?.Labels?.RELEASE_ID ??
    container.Config?.Env?.find((entry) => entry.startsWith('RELEASE_ID='))?.slice(
      'RELEASE_ID='.length,
    )
  );
}

export function dockerSnapshot({ manifest, project }) {
  if (typeof project !== 'string' || project.length === 0) {
    throw new Error('A Docker Compose project is required for Docker attestation.');
  }
  const inspected = inspectProject(project);
  const labels = inspected[0]?.Config?.Labels ?? {};
  const services = Object.fromEntries(
    inspected
      .map((container) => [container.Config?.Labels?.['com.docker.compose.service'], container])
      .filter(([service]) => typeof service === 'string')
      .map(([service, container]) => {
        const imageName = APP_IMAGES[service];
        return [
          service,
          {
            image: imageName
              ? `${manifest.images[imageName].repository}@${container.Image}`
              : container.Image,
            releaseId: releaseId(container),
            workingDirectory:
              container.Config?.Labels?.['com.room.release.working_directory'] ??
              container.Config?.Labels?.['com.docker.compose.project.working_dir'],
            state: container.State?.Running ? 'running' : container.State?.Status,
          },
        ];
      }),
  );
  return {
    services,
    currentPointer: labels['com.room.release.current_pointer'],
    sharedReleaseId: labels['com.room.release.shared_release_id'],
    composeSha256: labels['com.room.release.compose_sha256'],
    caddySha256: labels['com.room.release.caddy_sha256'],
    migrationCompleted: labels['com.room.release.migration_completed'] === 'true',
  };
}
