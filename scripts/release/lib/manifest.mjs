import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertPlainObject, assertSha256, canonicalJson, hashFile, sha256 } from './canonical.mjs';
import { deriveMigrationSet } from './migrations.mjs';

const SOURCE_SHA_PATTERN = /^[a-f0-9]{40,64}$/iu;
const IMAGE_DIGEST_PATTERN = /^sha256:([a-f0-9]{64})$/iu;
const RELEASE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/iu;
const REQUIRED_APPLICATION_IMAGES = ['web', 'api', 'worker', 'paymentDemo'];
const REQUIRED_COMPOSE_SERVICES = [
  'caddy',
  'web',
  'payment-demo',
  'api',
  'worker',
  'postgres',
  'redis',
  'migrate',
];

function assertSourceSha(value) {
  if (typeof value !== 'string' || !SOURCE_SHA_PATTERN.test(value)) {
    throw new Error('Source SHA must be a 40 to 64 character hexadecimal revision.');
  }
}

function assertSourceTreeSha(value) {
  if (typeof value !== 'string' || !SOURCE_SHA_PATTERN.test(value)) {
    throw new Error('Source tree SHA must be a 40 to 64 character hexadecimal revision.');
  }
}

function assertImage(image, name) {
  assertPlainObject(image, `${name} image`);
  if (typeof image.repository !== 'string' || image.repository.length === 0) {
    throw new Error(`${name} image repository is required.`);
  }
  if (image.repository.endsWith(':latest')) {
    throw new Error(`${name} image must not use :latest.`);
  }
  if (typeof image.digest !== 'string' || !IMAGE_DIGEST_PATTERN.test(image.digest)) {
    throw new Error(`${name} image must use an immutable digest.`);
  }
}

function normalizeMigrations(migrations) {
  assertPlainObject(migrations, 'Migrations');
  if (
    typeof migrations.latest !== 'string' ||
    !/^\d{4}_[a-z0-9_]+\.sql$/iu.test(migrations.latest)
  ) {
    throw new Error('Migration latest entry is invalid.');
  }
  assertSha256(migrations.aggregateSha256, 'Migration aggregate');
  const rollbackCompatibleWith = migrations.rollbackCompatibleWith ?? [];
  if (!Array.isArray(rollbackCompatibleWith)) {
    throw new Error('Migration rollback compatibility must be an array.');
  }
  for (const digest of rollbackCompatibleWith) {
    assertSha256(digest, 'Migration rollback compatibility digest');
  }
  return {
    latest: migrations.latest,
    aggregateSha256: migrations.aggregateSha256,
    rollbackCompatibleWith: [...rollbackCompatibleWith].sort(),
  };
}

function identityPayload(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    sourceSha: manifest.sourceSha,
    sourceTreeSha: manifest.sourceTreeSha,
    images: manifest.images,
    compose: manifest.compose,
    caddy: manifest.caddy,
    migrations: manifest.migrations,
    envSchema: manifest.envSchema,
  };
}

export function releaseIdentity(manifest) {
  return `sha256:${sha256(canonicalJson(identityPayload(manifest)))}`;
}

export function createManifest({
  sourceSha,
  sourceTreeSha,
  createdAt,
  images,
  composeSha256,
  caddySha256,
  migrations,
  envSchemaSha256,
}) {
  assertSourceSha(sourceSha);
  assertSourceTreeSha(sourceTreeSha);
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new Error('createdAt must be an ISO-8601 timestamp.');
  }
  assertPlainObject(images, 'Images');
  const normalizedImages = {};
  for (const name of REQUIRED_APPLICATION_IMAGES) {
    assertImage(images[name], name);
    normalizedImages[name] = {
      repository: images[name].repository,
      digest: images[name].digest.toLowerCase(),
    };
  }
  assertSha256(composeSha256, 'Compose digest');
  assertSha256(caddySha256, 'Caddy digest');
  assertSha256(envSchemaSha256, 'Environment schema digest');

  const manifest = {
    schemaVersion: 1,
    sourceSha: sourceSha.toLowerCase(),
    sourceTreeSha: sourceTreeSha.toLowerCase(),
    createdAt,
    images: normalizedImages,
    compose: { sha256: composeSha256.toLowerCase() },
    caddy: { sha256: caddySha256.toLowerCase() },
    migrations: normalizeMigrations(migrations),
    envSchema: { sha256: envSchemaSha256.toLowerCase() },
  };
  return { ...manifest, releaseId: releaseIdentity(manifest) };
}

function assertManifest(manifest) {
  assertPlainObject(manifest, 'Release manifest');
  if (manifest.schemaVersion !== 1) throw new Error('Release manifest schemaVersion must be 1.');
  assertSourceSha(manifest.sourceSha);
  assertSourceTreeSha(manifest.sourceTreeSha);
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) {
    throw new Error('Release manifest createdAt is invalid.');
  }
  assertPlainObject(manifest.images, 'Release manifest images');
  for (const name of REQUIRED_APPLICATION_IMAGES) assertImage(manifest.images[name], name);
  assertPlainObject(manifest.compose, 'Release manifest compose');
  assertPlainObject(manifest.caddy, 'Release manifest caddy');
  assertPlainObject(manifest.envSchema, 'Release manifest environment schema');
  assertSha256(manifest.compose.sha256, 'Compose digest');
  assertSha256(manifest.caddy.sha256, 'Caddy digest');
  assertSha256(manifest.envSchema.sha256, 'Environment schema digest');
  normalizeMigrations(manifest.migrations);
  if (typeof manifest.releaseId !== 'string' || !RELEASE_ID_PATTERN.test(manifest.releaseId)) {
    throw new Error('Release manifest releaseId is invalid.');
  }
  if (manifest.releaseId !== releaseIdentity(manifest)) {
    throw new Error('Release manifest releaseId does not match its immutable identity.');
  }
}

function composeServiceNames(composeText) {
  const servicesSection = /^services:\s*\r?\n([\s\S]*)$/mu.exec(composeText)?.[1];
  if (servicesSection === undefined) throw new Error('Compose file does not define services.');
  return new Set(
    [...servicesSection.matchAll(/^ {2}([a-z0-9-]+):\s*$/gimu)].map((match) => match[1]),
  );
}

export function verifyManifest({ manifest, releaseDirectory, repositoryRoot }) {
  assertManifest(manifest);
  const composePath = join(releaseDirectory, 'docker-compose.production.yml');
  const caddyPath = join(releaseDirectory, 'deploy', 'Caddyfile');
  const environmentSchemaPath = join(releaseDirectory, 'deploy', 'environment-schema.json');

  if (hashFile(composePath) !== manifest.compose.sha256)
    throw new Error('Compose digest mismatch.');
  if (hashFile(caddyPath) !== manifest.caddy.sha256) throw new Error('Caddy digest mismatch.');
  if (hashFile(environmentSchemaPath) !== manifest.envSchema.sha256) {
    throw new Error('Environment schema digest mismatch.');
  }

  const source = JSON.parse(readFileSync(join(releaseDirectory, 'release-source.json'), 'utf8'));
  if (source.sourceSha !== manifest.sourceSha || source.treeSha !== manifest.sourceTreeSha) {
    throw new Error('Release source identity does not match the release manifest.');
  }

  const services = composeServiceNames(readFileSync(composePath, 'utf8'));
  for (const service of REQUIRED_COMPOSE_SERVICES) {
    if (!services.has(service)) throw new Error(`Compose is missing required service ${service}.`);
  }

  const actualMigrations = deriveMigrationSet(repositoryRoot);
  if (
    actualMigrations.latest !== manifest.migrations.latest ||
    actualMigrations.aggregateSha256 !== manifest.migrations.aggregateSha256
  ) {
    throw new Error('Migration set does not match the release manifest.');
  }

  return { ok: true, manifest };
}
