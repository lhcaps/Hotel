#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) {
  console.error('Usage: fix-imports.mjs <root>');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const PROTECTED = '(protected)';
let changed = 0;

for (const file of walk(ROOT)) {
  if (!file.includes(`${sep}${PROTECTED}${sep}`) && !file.endsWith(`${sep}${PROTECTED}`)) continue;
  // Compute depth from protected group to the file. depth = number of
  // directory levels between (protected) and page.tsx, exclusive of the
  // file itself. We count parent directories only.
  const afterProtected = file
    .substring(file.indexOf(PROTECTED) + PROTECTED.length)
    .replace(/^[\\/]/, '');
  const segments = afterProtected ? afterProtected.split(/[\\/]/) : [];
  // Last segment is the file name; everything before is the depth.
  const depth = Math.max(0, segments.length - 1);
  // depth 0 -> (protected)/page.tsx -> needs 3 ../
  // depth 1 -> (protected)/foo/page.tsx -> needs 4 ../
  // depth 2 -> (protected)/foo/bar/page.tsx -> needs 5 ../
  const dots = '../'.repeat(depth + 3);
  let content = readFileSync(file, 'utf8');
  const original = content;
  // Replace the whole leading ../ chain (if any) before components|lib|app.
  content = content.replace(
    /from '((?:\.\.\/)+)(components|lib|app)\//g,
    (_, _reps, sub) => `from '${dots}${sub}/`,
  );
  if (content !== original) {
    writeFileSync(file, content);
    changed++;
  }
}

console.log(`Fixed ${changed} files in ${ROOT}`);
