import type { Locale, MessageKey } from './i18n/messages';
import { translate } from './i18n/messages';

/**
 * Catalog archive/retype structured error codes. The values must match
 * the `CatalogSafetyCode` union in `apps/api/src/catalog/catalog.safety.ts`.
 * The repository's API filter surfaces these as `problem.code` on every
 * `application/problem+json` response.
 */
export type CatalogSafetyCode =
  | 'ROOM_ARCHIVE_ACTIVE_BOOKING'
  | 'ROOM_ARCHIVE_FUTURE_BOOKING'
  | 'ROOM_ARCHIVE_ACTIVE_MAINTENANCE'
  | 'ROOM_ARCHIVE_FUTURE_MAINTENANCE'
  | 'ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK'
  | 'ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK'
  | 'ROOM_RETYPE_ACTIVE_BOOKING'
  | 'ROOM_RETYPE_FUTURE_BOOKING'
  | 'ROOM_RETYPE_ACTIVE_MAINTENANCE'
  | 'ROOM_RETYPE_FUTURE_MAINTENANCE'
  | 'ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS'
  | 'ROOM_TYPE_ARCHIVE_FUTURE_BOOKING'
  | 'ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE'
  | 'ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE'
  | 'ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN';

const SAFETY_I18N_KEY: Record<CatalogSafetyCode, MessageKey> = {
  ROOM_ARCHIVE_ACTIVE_BOOKING: 'catalog.safety.room.archiveActiveBooking',
  ROOM_ARCHIVE_FUTURE_BOOKING: 'catalog.safety.room.archiveFutureBooking',
  ROOM_ARCHIVE_ACTIVE_MAINTENANCE: 'catalog.safety.room.archiveActiveMaintenance',
  ROOM_ARCHIVE_FUTURE_MAINTENANCE: 'catalog.safety.room.archiveFutureMaintenance',
  ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK: 'catalog.safety.room.archiveActiveInventoryBlock',
  ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK: 'catalog.safety.room.archiveFutureInventoryBlock',
  ROOM_RETYPE_ACTIVE_BOOKING: 'catalog.safety.room.retypeActiveBooking',
  ROOM_RETYPE_FUTURE_BOOKING: 'catalog.safety.room.retypeFutureBooking',
  ROOM_RETYPE_ACTIVE_MAINTENANCE: 'catalog.safety.room.retypeActiveMaintenance',
  ROOM_RETYPE_FUTURE_MAINTENANCE: 'catalog.safety.room.retypeFutureMaintenance',
  ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS: 'catalog.safety.roomType.archiveActiveRooms',
  ROOM_TYPE_ARCHIVE_FUTURE_BOOKING: 'catalog.safety.roomType.archiveFutureBooking',
  ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE: 'catalog.safety.roomType.archiveActiveMaintenance',
  ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE: 'catalog.safety.roomType.archiveFutureMaintenance',
  ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN: 'catalog.safety.roomType.archiveActiveRatePlan',
};

export function isCatalogSafetyCode(value: unknown): value is CatalogSafetyCode {
  return typeof value === 'string' && value in SAFETY_I18N_KEY;
}

/**
 * Map a structured catalog safety code (or a server-supplied `detail`
 * message) into a localized user-facing string. Falls back to the
 * server `detail` when available, then to a generic safety message.
 */
export function localizedCatalogSafetyReason(
  locale: Locale,
  code: string | undefined,
  detail: string | undefined,
): string {
  if (code !== undefined && isCatalogSafetyCode(code)) {
    return translate(locale, SAFETY_I18N_KEY[code]);
  }
  if (detail !== undefined && detail !== '') {
    return detail;
  }
  return translate(locale, 'catalog.safety.unknown');
}
