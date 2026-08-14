import { type PublicContact } from '@room/contracts';

export async function loadPublicContact(propertyCode: string): Promise<PublicContact | null> {
  const baseUrl = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl === undefined) return null;
  try {
    const response = await fetch(
      `${baseUrl}/public/properties/${encodeURIComponent(propertyCode)}/contact`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as PublicContact;
    return json;
  } catch {
    return null;
  }
}

export function emptyPublicContact(): PublicContact {
  return {};
}
