import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** @typedef {{creationDate: string, executablePath: string, commandLine: string}} ProcessIdentity */

const execFileAsync = promisify(execFile);

/** A service is ready only when its documented endpoint returns HTTP 200. */
export function isExactReadyStatus(status) {
  return status === 200;
}

/**
 * A PID alone is not ownership proof on Windows because PIDs can be reused.
 * All fields must match the process snapshot captured by the starter.
 *
 * @param {ProcessIdentity | undefined} expected
 * @param {ProcessIdentity | undefined} actual
 */
export function matchesProcessIdentity(expected, actual) {
  if (expected === undefined || actual === undefined) return false;
  return (
    expected.creationDate === actual.creationDate &&
    expected.executablePath === actual.executablePath &&
    expected.commandLine === actual.commandLine
  );
}

/**
 * @param {unknown} entry
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateOwnedProcessEntry(entry) {
  if (typeof entry !== 'object' || entry === null) {
    return { ok: false, reason: 'entry is not an object' };
  }
  const candidate =
    /** @type {{pid?: unknown, service?: unknown, startedAt?: unknown, identity?: unknown}} */ (
      entry
    );
  if (typeof candidate.pid !== 'number' || !Number.isInteger(candidate.pid) || candidate.pid <= 0) {
    return { ok: false, reason: 'entry has no positive integer PID' };
  }
  if (typeof candidate.service !== 'string' || candidate.service.length === 0) {
    return { ok: false, reason: 'entry has no service name' };
  }
  if (typeof candidate.startedAt !== 'string' || candidate.startedAt.length === 0) {
    return { ok: false, reason: 'entry has no start timestamp' };
  }
  const identity = candidate.identity;
  if (
    typeof identity !== 'object' ||
    identity === null ||
    typeof (/** @type {ProcessIdentity} */ (identity).creationDate) !== 'string' ||
    typeof (/** @type {ProcessIdentity} */ (identity).executablePath) !== 'string' ||
    typeof (/** @type {ProcessIdentity} */ (identity).commandLine) !== 'string'
  ) {
    return { ok: false, reason: 'entry has no complete process identity' };
  }
  return { ok: true };
}

/**
 * Capture a Windows process identity that remains invalid when its PID is
 * reused. This runs without a shell and validates the PID before interpolating
 * it into the CIM filter.
 *
 * @param {number} pid
 * @returns {Promise<ProcessIdentity | undefined>}
 */
export async function inspectWindowsProcessIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || process.platform !== 'win32') return undefined;
  const command = [
    `$target = Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${pid}'`,
    'if ($null -eq $target) { exit 3 }',
    '[PSCustomObject]@{ creationDate = [string]$target.CreationDate; executablePath = [string]$target.ExecutablePath; commandLine = [string]$target.CommandLine } | ConvertTo-Json -Compress',
  ].join('; ');
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], {
      windowsHide: true,
    });
    const parsed = /** @type {unknown} */ (JSON.parse(stdout));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (/** @type {ProcessIdentity} */ (parsed).creationDate) !== 'string' ||
      typeof (/** @type {ProcessIdentity} */ (parsed).executablePath) !== 'string' ||
      typeof (/** @type {ProcessIdentity} */ (parsed).commandLine) !== 'string'
    ) {
      return undefined;
    }
    const identity = /** @type {ProcessIdentity} */ (parsed);
    return identity.creationDate.length > 0 &&
      identity.executablePath.length > 0 &&
      identity.commandLine.length > 0
      ? identity
      : undefined;
  } catch {
    return undefined;
  }
}
