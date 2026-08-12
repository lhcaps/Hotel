export function resolvePublicApiOrigin(apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL) {
  const candidate = apiBaseUrl?.trim();
  if (candidate === undefined || candidate.length === 0) return undefined;

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}
