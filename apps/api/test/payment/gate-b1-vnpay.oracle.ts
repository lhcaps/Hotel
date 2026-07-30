import { createHmac } from 'node:crypto';

const excluded = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);
const safe = (byte: number) =>
  (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5a) ||
  (byte >= 0x61 && byte <= 0x7a) || [0x2d, 0x2e, 0x5f, 0x7e].includes(byte);

function formEncode(value: string): string {
  let output = '';
  for (const byte of Buffer.from(value, 'utf8')) {
    output += safe(byte) ? String.fromCharCode(byte) : byte === 0x20 ? '+' : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return output;
}

export function oracleVnpayCanonical(fields: Readonly<Record<string, string>>): string {
  return Object.keys(fields)
    .filter((key) => key.startsWith('vnp_') && !excluded.has(key) && fields[key] !== '')
    .sort()
    .map((key) => `${formEncode(key)}=${formEncode(fields[key] as string)}`)
    .join('&');
}

export function oracleHmacSha512(secret: string, canonical: string): string {
  return createHmac('sha512', secret).update(canonical, 'utf8').digest('hex');
}

export function oracleVnpayAmount(amountVnd: bigint): string {
  return (amountVnd * 100n).toString();
}

export function oracleVnpayTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}
