import type { PublicRoomCatalogResponse } from '@room/contracts/public-room-catalog';

export type PublicCatalogState =
  | { readonly kind: 'ready'; readonly catalog: PublicRoomCatalogResponse }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unavailable' };

export function toPublicCatalogState(
  catalog: PublicRoomCatalogResponse | null,
): PublicCatalogState {
  if (catalog === null) return { kind: 'unavailable' };
  if (catalog.items.length === 0) return { kind: 'empty' };
  return { kind: 'ready', catalog };
}
