import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoots = [join(root, 'apps/web/src/app'), join(root, 'apps/web/src/components')];
const vietnameseCharacter = /[ĂÂĐÊÔƠƯăâđêôơưÀ-ỹ]/u;
const excludedPathParts = ['/messages.ts', '/locale-provider.tsx'];

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) return [];
    if (entry.name.includes('.test.') || entry.name.includes('.stories.')) return [];
    return [path];
  }));
  return nested.flat();
}

const files = (await Promise.all(sourceRoots.map(collectFiles))).flat();
const findings: string[] = [];

for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  if (excludedPathParts.some((part) => normalized.endsWith(part))) continue;
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (vietnameseCharacter.test(line)) {
      findings.push(`${relative(root, file)}:${index + 1}: ${line.trim()} | replacement key: translate(locale, '<required-key>')`);
    }
  });
}

console.log(`CRITICAL_SOURCE_FILES_SCANNED=${files.length}`);
console.log(`DIRECT_VI_COPY_CRITICAL_SOURCE=${findings.length}`);
if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
