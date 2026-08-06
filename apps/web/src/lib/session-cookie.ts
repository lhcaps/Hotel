const SESSION_COOKIE_NAMES = new Set([
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
]);

export function rewriteSessionCookie(setCookie: string): string | null {
  const pair = setCookie.split(';')[0];
  if (pair === undefined || pair.length === 0) return null;
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!SESSION_COOKIE_NAMES.has(name)) return null;

  const attrs = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (name.startsWith('__Secure-') || /;\s*Secure(?:;|$)/i.test(setCookie)) {
    attrs.push('Secure');
  }
  const maxAgeMatch = /Max-Age=(-?\d+)/i.exec(setCookie);
  const expiresMatch = /Expires=([^;]+)/i.exec(setCookie);
  if (maxAgeMatch !== null) attrs.push(`Max-Age=${maxAgeMatch[1]}`);
  if (expiresMatch !== null) attrs.push(`Expires=${expiresMatch[1]}`);
  return attrs.join('; ');
}
