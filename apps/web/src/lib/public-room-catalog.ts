import {
  publicRoomCatalogResponseSchema,
  type PublicRoomCatalogResponse,
  type PublicRoomType,
} from '@room/contracts/public-room-catalog';

export async function loadPublicRoomCatalog(): Promise<PublicRoomCatalogResponse | null> {
  // Catalog loaders run on the Next.js server. Prefer the private Compose
  // network so public-page rendering does not depend on resolving the public
  // hostname from inside an application container.
  const baseUrl = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl === undefined) return null;
  try {
    const response = await fetch(`${baseUrl}/public/room-types`, { cache: 'no-store' });
    if (!response.ok) return null;
    return publicRoomCatalogResponseSchema.parse(await response.json());
  } catch {
    return null;
  }
}

export async function loadPublicRoomType(roomTypeId: string): Promise<PublicRoomType | null> {
  const catalog = await loadPublicRoomCatalog();
  return catalog?.items.find((room) => room.id === roomTypeId) ?? null;
}

const roomImagesByCode: Readonly<Record<string, string>> = {
  ROSE: '/images/peace-home/rose/rose-066-card.webp',
  NAMI: '/images/peace-home/nami/nami-030-card.webp',
  PHU_VAN: '/images/peace-home/phu-van/phu-van-062-card.webp',
  SUNSET: '/images/peace-home/sunset/sunset-020-card.webp',
  YUKI: '/images/peace-home/yuki/yuki-057-card.webp',
  SABI: '/images/peace-home/sabi/sabi-041-card.webp',
  SUDAL: '/images/peace-home/sudal/sudal-028-card.webp',
  WABI: '/images/peace-home/wabi/wabi-124-card.webp',
  HAVEN: '/images/peace-home/haven/haven-049-card.webp',
};

export function publicRoomImage(roomTypeCode: string): string | undefined {
  return roomImagesByCode[roomTypeCode];
}
