import type {
  PublicRoomCatalogResponse,
  PublicRoomType,
} from '@room/contracts/public-room-catalog';

/**
 * Client-owned visual assignments only. Display names, tier membership,
 * capacity, amenities, and prices are always read from the public catalog.
 */
export interface PeaceNestRoomMedia {
  readonly code: string;
  readonly slug: string;
  readonly gallery: readonly [string, ...string[]];
}

const gallery = (room: string, indexes: readonly [number, ...number[]]) =>
  indexes.map(
    (index) => `/images/peace-home/${room}/${room}-${index.toString().padStart(3, '0')}-hero.webp`,
  ) as [string, ...string[]];

export const peaceNestRoomMedia: readonly PeaceNestRoomMedia[] = [
  { code: 'ROSE', slug: 'rose', gallery: gallery('rose', [66, 7, 14, 22, 44, 0]) },
  { code: 'NAMI', slug: 'nami', gallery: gallery('nami', [30, 25, 35, 20, 46, 15]) },
  {
    code: 'PHU_VAN',
    slug: 'phu-van',
    gallery: gallery('phu-van', [62, 20, 27, 34, 41, 48, 6]),
  },
  { code: 'SUNSET', slug: 'sunset', gallery: gallery('sunset', [20, 0, 13, 27, 33, 40, 54]) },
  { code: 'YUKI', slug: 'yuki', gallery: gallery('yuki', [57, 25, 38, 44, 50, 12, 0]) },
  { code: 'SABI', slug: 'sabi', gallery: gallery('sabi', [41, 23, 35, 0, 11, 17]) },
  { code: 'SUDAL', slug: 'sudal', gallery: gallery('sudal', [28, 0, 5, 17, 40, 52]) },
  { code: 'WABI', slug: 'wabi', gallery: gallery('wabi', [124, 110, 27, 55, 68, 96, 0]) },
  { code: 'HAVEN', slug: 'haven', gallery: gallery('haven', [49, 43, 32, 38, 16, 21, 5]) },
];

export interface PresentedPhysicalRoom extends PeaceNestRoomMedia {
  readonly roomType: PublicRoomType;
}

export function roomStartingPrice(room: PresentedPhysicalRoom): number | null {
  return room.roomType.startingFromVnd ?? null;
}

export interface PresentedTierSummary {
  readonly code: string;
  readonly name: string;
  readonly rooms: readonly PresentedPhysicalRoom[];
  readonly representative: PresentedPhysicalRoom;
}

export function presentTierSummaries(
  catalog: PublicRoomCatalogResponse,
): readonly PresentedTierSummary[] {
  const groups = new Map<
    string,
    { readonly name: string; readonly sortOrder: number; readonly rooms: PresentedPhysicalRoom[] }
  >();
  for (const room of presentPhysicalRooms(catalog)) {
    const tier = room.roomType.priceTier;
    if (tier === undefined) continue;
    const group = groups.get(tier.code) ?? {
      name: tier.name,
      sortOrder: tier.sortOrder,
      rooms: [],
    };
    group.rooms.push(room);
    groups.set(tier.code, group);
  }
  return [...groups.entries()]
    .sort(([leftCode, left], [rightCode, right]) =>
      left.sortOrder === right.sortOrder
        ? leftCode.localeCompare(rightCode)
        : left.sortOrder - right.sortOrder,
    )
    .flatMap(([code, group]) => {
      const representative = group.rooms[0];
      return representative === undefined
        ? []
        : [{ code, name: group.name, rooms: group.rooms, representative }];
    });
}

export function presentPhysicalRooms(
  catalog: PublicRoomCatalogResponse,
): readonly PresentedPhysicalRoom[] {
  const roomTypeByCode = new Map(catalog.items.map((item) => [item.code, item]));
  return peaceNestRoomMedia.flatMap((media) => {
    const roomType = roomTypeByCode.get(media.code);
    return roomType === undefined ? [] : [{ ...media, roomType }];
  });
}

export function findPresentedPhysicalRoom(
  catalog: PublicRoomCatalogResponse,
  slugOrRoomTypeId: string,
): PresentedPhysicalRoom | undefined {
  const requestedCode = slugOrRoomTypeId.toUpperCase();
  return presentPhysicalRooms(catalog).find(
    (room) =>
      room.slug === slugOrRoomTypeId ||
      room.code === requestedCode ||
      room.roomType.id === slugOrRoomTypeId,
  );
}

export const peaceHomeCommonImages = gallery('common', [27, 18, 36, 46, 64, 73, 83, 9]);
