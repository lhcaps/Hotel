import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
  root,
  'apps',
  'web',
  'src',
  'content',
  'peace-home-media-provenance.json',
);
const publicRoot = path.join(root, 'apps', 'web', 'public');
const expectedRooms = [
  'rose',
  'nami',
  'phu-van',
  'sunset',
  'yuki',
  'sabi',
  'sudal',
  'wabi',
  'haven',
  'common',
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.derivativeFormat !== 'webp-srgb-exif-stripped') {
  throw new Error('Peace Home media provenance schema is invalid.');
}
if (
  JSON.stringify(manifest.entryLayout) !==
  JSON.stringify([
    'driveFileId',
    'sourceSha256',
    'sourceBytes',
    'width',
    'height',
    'orientation',
    'sourceCandidateIndex',
    'heroSha256',
    'cardSha256',
    'thumbSha256',
  ])
) {
  throw new Error('Peace Home media provenance entry layout is invalid.');
}
if (
  JSON.stringify(Object.keys(manifest.rooms).sort()) !== JSON.stringify([...expectedRooms].sort())
) {
  throw new Error(
    'Peace Home media manifest must contain the nine room folders plus common media.',
  );
}

let sourceCount = 0;
let derivativeCount = 0;
for (const room of expectedRooms) {
  const entries = manifest.rooms[room];
  if (!Array.isArray(entries) || entries.length < 6 || entries.length > 10) {
    throw new Error(`${room} must contain six to ten selected source images.`);
  }
  for (const entry of entries) {
    sourceCount += 1;
    const [
      driveFileId,
      sourceSha256,
      sourceBytes,
      width,
      height,
      orientation,
      sourceIndex,
      ...checksums
    ] = entry;
    if (
      !/^[A-Za-z0-9_-]{20,}$/.test(driveFileId) ||
      !/^[a-f0-9]{64}$/.test(sourceSha256) ||
      !Number.isInteger(sourceBytes) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      !['landscape', 'portrait', 'square'].includes(orientation) ||
      !Number.isInteger(sourceIndex)
    ) {
      throw new Error(`${room} has an invalid Drive provenance record.`);
    }
    for (const [offset, kind] of ['hero', 'card', 'thumb'].entries()) {
      const checksum = checksums[offset];
      if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error(`${room} is missing ${kind} checksum.`);
      const filename = `${room}-${sourceIndex.toString().padStart(3, '0')}-${kind}.webp`;
      const localPath = path.join(publicRoot, 'images', 'peace-home', room, filename);
      const [bytes, details] = await Promise.all([readFile(localPath), stat(localPath)]);
      if (details.size < 1 || sha256(bytes) !== checksum) {
        throw new Error(`${room} ${kind} media does not match its provenance checksum.`);
      }
      derivativeCount += 1;
    }
  }
}
if (sourceCount !== 67 || derivativeCount !== 201) {
  throw new Error(
    `Unexpected Peace Home media inventory: ${sourceCount} sources / ${derivativeCount} derivatives.`,
  );
}
process.stdout.write(`PEACE_HOME_MEDIA_OK|sources=${sourceCount}|derivatives=${derivativeCount}\n`);
