import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PUBLIC_API_PATH = '/api/v1';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function parseHttpsOrigin(value, name) {
  const candidate = requiredString(value, name);
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    parsed.pathname !== '/'
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or hash.`);
  }
  return parsed;
}

export function validatePublicBuildConfig({ apiBaseUrl, publicDomain, webOrigin }) {
  const apiCandidate = requiredString(apiBaseUrl, 'NEXT_PUBLIC_API_BASE_URL');
  const domain = requiredString(publicDomain, 'PUBLIC_DOMAIN').toLowerCase();
  let domainUrl;
  try {
    domainUrl = new URL(`https://${domain}`);
  } catch {
    throw new Error('PUBLIC_DOMAIN must be a valid hostname.');
  }
  if (
    domainUrl.hostname !== domain ||
    domainUrl.pathname !== '/' ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u.test(
      domain,
    )
  ) {
    throw new Error('PUBLIC_DOMAIN must be a valid hostname.');
  }

  const web = parseHttpsOrigin(webOrigin, 'WEB_ORIGIN');
  if (web.hostname !== domain) {
    throw new Error('WEB_ORIGIN must use PUBLIC_DOMAIN.');
  }

  let api;
  try {
    api = new URL(apiCandidate);
  } catch {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must be an absolute HTTPS URL.');
  }
  if (
    api.protocol !== 'https:' ||
    api.username.length > 0 ||
    api.password.length > 0 ||
    api.search.length > 0 ||
    api.hash.length > 0 ||
    api.hostname !== web.hostname ||
    api.port !== web.port ||
    api.pathname !== PUBLIC_API_PATH
  ) {
    throw new Error(`NEXT_PUBLIC_API_BASE_URL must equal ${web.origin}${PUBLIC_API_PATH}.`);
  }

  const canonical = `${web.origin}${PUBLIC_API_PATH}`;
  return {
    apiBaseUrl: canonical,
    webOrigin: web.origin,
    publicDomain: domain,
    fingerprint: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = validatePublicBuildConfig({
      apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      publicDomain: process.env.PUBLIC_DOMAIN,
      webOrigin: process.env.WEB_ORIGIN,
    });
    process.stdout.write(
      `PUBLIC_BUILD_CONFIG=PASS\nPUBLIC_BUILD_CONFIG_FINGERPRINT=${config.fingerprint}\n`,
    );
  } catch (error) {
    process.stdout.write('PUBLIC_BUILD_CONFIG=FAIL\n');
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
