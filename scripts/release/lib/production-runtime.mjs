import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

function pointerPath(targetRoot) {
  return resolve(targetRoot, 'current');
}

function legacyPointerDirectory(targetRoot, pointer) {
  return isAbsolute(pointer)
    ? resolve(pointer)
    : resolve(targetRoot, 'releases', pointer.replace(':', '-'));
}

export function readProductionCurrentPointer(targetRoot) {
  const pointer = pointerPath(targetRoot);
  if (!existsSync(pointer)) return undefined;
  const status = lstatSync(pointer);
  if (status.isSymbolicLink()) return realpathSync(pointer);
  if (!status.isFile())
    throw new Error('Production current pointer must be a symlink or release ID file.');
  const value = readFileSync(pointer, 'utf8').trim();
  if (value.length === 0) throw new Error('Production current pointer is empty.');
  return legacyPointerDirectory(targetRoot, value);
}

export function switchProductionCurrentPointer({ targetRoot, releaseDirectory }) {
  const pointer = pointerPath(targetRoot);
  const target = resolve(releaseDirectory);
  if (!existsSync(target)) throw new Error('Production current pointer target does not exist.');
  const temporary = join(resolve(targetRoot), `.current-${process.pid}-${Date.now()}.next`);
  rmSync(temporary, { recursive: true, force: true });
  symlinkSync(target, temporary, process.platform === 'win32' ? 'junction' : 'dir');
  if (process.platform === 'win32' && existsSync(pointer)) {
    rmSync(pointer, { recursive: true, force: true });
  }
  renameSync(temporary, pointer);
  return target;
}
