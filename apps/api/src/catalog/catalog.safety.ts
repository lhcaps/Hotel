/**
 * Structured domain errors for catalog archive and retype safety.
 *
 * The catalog service must reject archive/retype operations against rooms
 * and room types that have blocking commitments or dependencies. Each
 * rejection is exposed to the API layer through a stable `code` so the
 * ADMIN UI can map the failure to a localised reason without inspecting
 * SQL or stack traces.
 */
export type CatalogSafetyCode =
  // Physical room archive rejections
  | 'ROOM_ARCHIVE_ACTIVE_BOOKING'
  | 'ROOM_ARCHIVE_FUTURE_BOOKING'
  | 'ROOM_ARCHIVE_ACTIVE_MAINTENANCE'
  | 'ROOM_ARCHIVE_FUTURE_MAINTENANCE'
  | 'ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK'
  | 'ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK'
  // Physical room retype rejections
  | 'ROOM_RETYPE_ACTIVE_BOOKING'
  | 'ROOM_RETYPE_FUTURE_BOOKING'
  | 'ROOM_RETYPE_ACTIVE_MAINTENANCE'
  | 'ROOM_RETYPE_FUTURE_MAINTENANCE'
  // Room-type archive rejections
  | 'ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS'
  | 'ROOM_TYPE_ARCHIVE_FUTURE_BOOKING'
  | 'ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE'
  | 'ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE'
  | 'ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN';

export class CatalogSafetyError extends Error {
  public readonly code: CatalogSafetyCode;

  public constructor(code: CatalogSafetyCode, message: string) {
    super(message);
    this.name = 'CatalogSafetyError';
    this.code = code;
  }
}