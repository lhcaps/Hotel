import { isIP } from 'node:net';

function isValidProxyEntry(entry: string): boolean {
  const [host, prefix, extra] = entry.split('/');
  const version = host === undefined ? 0 : isIP(host);
  if (version === 0 || extra !== undefined) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  return Number(prefix) <= (version === 4 ? 32 : 128);
}

export function trustedProxy(value: string): false | string[] {
  const allowlist = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of allowlist) {
    if (!isValidProxyEntry(entry)) {
      throw new Error(`TRUSTED_PROXY_CIDRS contains an invalid IP or CIDR: ${entry}`);
    }
  }
  return allowlist.length === 0 ? false : allowlist;
}
