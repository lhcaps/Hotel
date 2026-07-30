/**
 * Extract the client IP for rate-limit/audit use.
 *
 * Production must be deployed behind a known trusted proxy. The CIDR
 * list is the only way `X-Forwarded-For` can be trusted — otherwise the
 * client can spoof the source IP and escape the rate-limit window. When
 * no proxy CIDR matches, we fall back to the socket address (no
 * spoofable surface).
 */

export type RawIp = string;

export interface RequestLike {
  readonly socket?: { readonly remoteAddress?: string | null } | null;
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly ip?: string;
}

export interface ProxyCidrEntry {
  readonly cidr: string;
}

const CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

export function parseCidrList(value: string): ProxyCidrEntry[] {
  return value
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw !== '')
    .map((raw) => parseCidrOrThrow(raw));
}

function parseCidrOrThrow(cidr: string): ProxyCidrEntry {
  const match = CIDR_REGEX.exec(cidr);
  if (match === null) {
    throw new RangeError(`Invalid CIDR: ${cidr}`);
  }
  const [, ...parts] = match;
  const bytes = parts.slice(0, 4).map((value) => Number(value));
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new RangeError(`Invalid CIDR octet in: ${cidr}`);
    }
  }
  const prefixLength = Number(parts[4]);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new RangeError(`Invalid CIDR prefix length in: ${cidr}`);
  }
  return { cidr };
}

function ipv4ToInt(value: string): number | null {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (match === null) return null;
  const octets = [match[1], match[2], match[3], match[4]].map((part) => Number(part));
  if (octets.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return null;
  }
  return (
    ((octets[0] ?? 0) << 24) | ((octets[1] ?? 0) << 16) | ((octets[2] ?? 0) << 8) | (octets[3] ?? 0)
  );
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const match = CIDR_REGEX.exec(cidr);
  if (match === null) return false;
  const prefixLength = Number(match[5]);
  const ipInt = ipv4ToInt(ip);
  const cidrInt = ipv4ToInt(`${match[1]}.${match[2]}.${match[3]}.${match[4]}`);
  if (ipInt === null || cidrInt === null) return false;
  if (prefixLength === 0) return true;
  const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) === (cidrInt & mask);
}

function firstForwardedFor(header: string | string[] | undefined): RawIp | null {
  if (typeof header === 'string') {
    const first = header.split(',')[0]?.trim();
    return first === undefined || first === '' ? null : first;
  }
  if (Array.isArray(header) && header.length > 0) {
    const head = header[0];
    if (typeof head === 'string') {
      const first = head.split(',')[0]?.trim();
      return first === undefined || first === '' ? null : first;
    }
  }
  return null;
}

export function extractRequestIp(
  request: RequestLike,
  trustedCidrs: readonly ProxyCidrEntry[],
): RawIp | null {
  const socketAddress = request.socket?.remoteAddress ?? request.ip ?? null;

  const forwardedFor = request.headers?.['x-forwarded-for'];
  const candidate = firstForwardedFor(forwardedFor);

  if (candidate !== null && socketAddress !== null) {
    for (const entry of trustedCidrs) {
      if (ipMatchesCidr(socketAddress, entry.cidr)) {
        return candidate;
      }
    }
  }

  return socketAddress;
}
